import json
from pathlib import Path
from uuid import uuid4

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text

from authorization import require_institution
from auth import router as auth_router
from database import get_db
from schemas import (
    StudentProfile,
    InstitutionProfile,
    OpportunityProcessRequest,
    OpportunitySubmissionRequest
)
from classification import analyze_profile
from scoring import score_opportunity

from ai_client import call_ai
from prompts import (
    build_extraction_prompt,
    extract_opportunity,
    build_roadmap_prompt,
    generate_roadmap,
    fallback_roadmap
)


app = FastAPI(title="Skill+ Backend")


# ============================================================
# FILE UPLOAD CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
LOGO_DIR = UPLOAD_DIR / "logos"
PROFILE_PICTURE_DIR = UPLOAD_DIR / "profile-pictures"

LOGO_DIR.mkdir(parents=True, exist_ok=True)
PROFILE_PICTURE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
}

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads"
)


# ============================================================
# FILE UPLOAD HELPERS
# ============================================================

async def validate_image(file: UploadFile):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, PNG, and WEBP images are allowed."
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image must be 5 MB or smaller."
        )

    extension = ALLOWED_IMAGE_TYPES[file.content_type]

    # Basic file-signature validation.
    if file.content_type == "image/jpeg":
        valid_signature = contents.startswith(b"\xff\xd8\xff")

    elif file.content_type == "image/png":
        valid_signature = contents.startswith(
            b"\x89PNG\r\n\x1a\n"
        )

    elif file.content_type == "image/webp":
        valid_signature = (
            len(contents) >= 12
            and contents[:4] == b"RIFF"
            and contents[8:12] == b"WEBP"
        )

    else:
        valid_signature = False

    if not valid_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is not a valid image."
        )

    return contents, extension


def remove_old_upload(relative_path: str | None):
    if not relative_path:
        return

    # Database paths look like:
    # /uploads/logos/example.png
    # /uploads/profile-pictures/example.png
    clean_path = relative_path.lstrip("/")

    if not clean_path.startswith("uploads/"):
        return

    old_file = Path(clean_path)

    try:
        if old_file.exists() and old_file.is_file():
            old_file.unlink()
    except OSError:
        # Failure to remove the old image should not stop
        # the new image from being uploaded.
        pass


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/")
def root():
    return {"message": "Skill+ backend is running"}


# ============================================================
# STUDENT PROFILE
# ============================================================

@app.post("/student-profile")
def create_student_profile(
    profile: StudentProfile,
    db: Session = Depends(get_db)
):
    try:
        saved_profile = db.execute(
            text("""
                INSERT INTO students (
                    user_id,
                    major,
                    year_of_study,
                    courses_taken,
                    current_skills,
                    interests,
                    career_goal,
                    available_time_per_week,
                    preferred_opportunity_type
                )
                VALUES (
                    :user_id,
                    :major,
                    :year_of_study,
                    :courses_taken,
                    :current_skills,
                    :interests,
                    :career_goal,
                    :available_time_per_week,
                    :preferred_opportunity_type
                )
                ON CONFLICT (user_id)
                DO UPDATE SET
                    major = EXCLUDED.major,
                    year_of_study = EXCLUDED.year_of_study,
                    courses_taken = EXCLUDED.courses_taken,
                    current_skills = EXCLUDED.current_skills,
                    interests = EXCLUDED.interests,
                    career_goal = EXCLUDED.career_goal,
                    available_time_per_week =
                        EXCLUDED.available_time_per_week,
                    preferred_opportunity_type =
                        EXCLUDED.preferred_opportunity_type
                RETURNING id
            """),
            {
                "user_id": profile.user_id,
                "major": profile.major,
                "year_of_study": profile.year_of_study,
                "courses_taken": profile.courses_taken,
                "current_skills": profile.current_skills,
                "interests": profile.interests,
                "career_goal": profile.career_goal,
                "available_time_per_week":
                    profile.available_time_per_week,
                "preferred_opportunity_type":
                    profile.preferred_opportunity_type,
            }
        ).fetchone()

        # A roadmap is based on the student's profile.
        # If the profile changes, remove the old cached roadmap.
        db.execute(
            text("""
                DELETE FROM roadmaps
                WHERE user_id = :user_id
            """),
            {"user_id": profile.user_id}
        )

        db.commit()

        return {
            "message": "Student profile saved successfully",
            "student_id": saved_profile.id
        }

    except Exception as e:
        db.rollback()

        if "foreign key constraint" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found. Please use an existing user_id."
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save student profile."
        )


@app.get("/student/profile/{user_id}")
def get_student_profile(
    user_id: int,
    db: Session = Depends(get_db)
):
    try:
        profile = db.execute(
            text("""
                SELECT
                    id,
                    user_id,
                    major,
                    year_of_study,
                    courses_taken,
                    current_skills,
                    interests,
                    career_goal,
                    available_time_per_week,
                    preferred_opportunity_type,
                    level,
                    profile_picture_url
                FROM students
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found."
            )

        return {
            "student_id": profile["id"],
            "user_id": profile["user_id"],
            "major": profile["major"],
            "year_of_study": profile["year_of_study"],
            "courses_taken": profile["courses_taken"],
            "current_skills": profile["current_skills"],
            "interests": profile["interests"],
            "career_goal": profile["career_goal"],
            "available_time_per_week":
                profile["available_time_per_week"],
            "preferred_opportunity_type":
                profile["preferred_opportunity_type"],
            "level": profile["level"],
            "profile_picture_url":
                profile["profile_picture_url"]
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve student profile."
        )


# ============================================================
# STUDENT PROFILE PICTURE UPLOAD
# ============================================================

@app.post("/student/{user_id}/profile-picture")
async def upload_student_profile_picture(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        student = db.execute(
            text("""
                SELECT
                    id,
                    profile_picture_url
                FROM students
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if student is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found."
            )

        contents, extension = await validate_image(file)

        filename = (
            f"{student['id']}_{uuid4().hex}{extension}"
        )

        file_path = PROFILE_PICTURE_DIR / filename

        relative_path = (
            f"/uploads/profile-pictures/{filename}"
        )

        try:
            file_path.write_bytes(contents)
        except OSError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not store profile picture."
            )

        old_path = student["profile_picture_url"]

        try:
            db.execute(
                text("""
                    UPDATE students
                    SET profile_picture_url = :profile_picture_url
                    WHERE user_id = :user_id
                """),
                {
                    "profile_picture_url": relative_path,
                    "user_id": user_id
                }
            )

            db.commit()

        except Exception:
            db.rollback()

            if file_path.exists():
                file_path.unlink()

            raise

        remove_old_upload(old_path)

        return {
            "message": "Profile picture uploaded successfully",
            "profile_picture_url": relative_path
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not upload profile picture."
        )

    finally:
        await file.close()


@app.post("/student/analyze/{user_id}")
def analyze_student(
    user_id: int,
    db: Session = Depends(get_db)
):
    try:
        profile = db.execute(
            text("""
                SELECT
                    year_of_study,
                    courses_taken,
                    current_skills
                FROM students
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found."
            )

        courses = len(profile["courses_taken"] or [])
        skills = len(profile["current_skills"] or [])
        year = profile["year_of_study"] or 0

        result = analyze_profile(
            year=year,
            courses=courses,
            skills=skills
        )

        db.execute(
            text("""
                UPDATE students
                SET level = :level
                WHERE user_id = :user_id
            """),
            {
                "level": result.level,
                "user_id": user_id
            }
        )

        db.commit()

        return {
            "user_id": user_id,
            "level": result.level,
            "strengths": result.strengths,
            "missing": result.missing,
            "next_step": result.next_step,
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not analyze student profile."
        )


# ============================================================
# INSTITUTION PROFILE
# ============================================================

@app.post("/institution-profile")
def create_institution_profile(
    profile: InstitutionProfile,
    db: Session = Depends(get_db)
):
    try:
        require_institution(profile.user_id, db)

        saved_profile = db.execute(
            text("""
                INSERT INTO institutions (
                    user_id,
                    institution_name,
                    website,
                    description
                )
                VALUES (
                    :user_id,
                    :institution_name,
                    :website,
                    :description
                )
                ON CONFLICT (user_id)
                DO UPDATE SET
                    institution_name = EXCLUDED.institution_name,
                    website = EXCLUDED.website,
                    description = EXCLUDED.description
                RETURNING id
            """),
            {
                "user_id": profile.user_id,
                "institution_name": profile.institution_name,
                "website": profile.website,
                "description": profile.description
            }
        ).fetchone()

        db.commit()

        return {
            "message": "Institution profile saved successfully",
            "institution_id": saved_profile.id
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save institution profile."
        )


@app.get("/institution/{user_id}")
def get_institution_profile(
    user_id: int,
    db: Session = Depends(get_db)
):
    institution = db.execute(
        text("""
            SELECT
                id,
                user_id,
                institution_name,
                website,
                description,
                logo_url
            FROM institutions
            WHERE user_id = :user_id
        """),
        {"user_id": user_id}
    ).mappings().fetchone()

    if institution is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institution profile not found."
        )

    return institution


# ============================================================
# INSTITUTION LOGO UPLOAD
# ============================================================

@app.post("/institution/{user_id}/logo")
async def upload_institution_logo(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        require_institution(user_id, db)

        institution = db.execute(
            text("""
                SELECT
                    id,
                    logo_url
                FROM institutions
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if institution is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Institution profile not found."
            )

        contents, extension = await validate_image(file)

        filename = (
            f"{institution['id']}_{uuid4().hex}{extension}"
        )

        file_path = LOGO_DIR / filename

        relative_path = f"/uploads/logos/{filename}"

        try:
            file_path.write_bytes(contents)
        except OSError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not store institution logo."
            )

        old_path = institution["logo_url"]

        try:
            db.execute(
                text("""
                    UPDATE institutions
                    SET logo_url = :logo_url
                    WHERE user_id = :user_id
                """),
                {
                    "logo_url": relative_path,
                    "user_id": user_id
                }
            )

            db.commit()

        except Exception:
            db.rollback()

            if file_path.exists():
                file_path.unlink()

            raise

        remove_old_upload(old_path)

        return {
            "message": "Institution logo uploaded successfully",
            "logo_url": relative_path
        }

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not upload institution logo."
        )

    finally:
        await file.close()
        
        
# ============================================================
# INSTITUTION BROWSE OWN OPPORTUNITIES
# ============================================================

@app.get("/institution/{user_id}/opportunities")
def get_institution_own_opportunities(
    user_id: int,
    db: Session = Depends(get_db)
):
    try:
        require_institution(user_id, db)

        institution = db.execute(
            text("""
                SELECT id
                FROM institutions
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if institution is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Institution profile not found."
            )

        opportunities = db.execute(
            text("""
                SELECT
                    id,
                    title,
                    category,
                    suitable_major,
                    suitable_year,
                    difficulty,
                    required_skills,
                    skills_gained,
                    deadline,
                    estimated_time,
                    cv_benefit,
                    link,
                    hours_per_week,
                    institution_id,
                    source
                FROM opportunities
                WHERE institution_id = :institution_id
                ORDER BY id
            """),
            {
                "institution_id": institution["id"]
            }
        ).mappings().all()

        return [
            dict(opportunity)
            for opportunity in opportunities
        ]

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve institution opportunities."
        ) 
        

# ============================================================
# INSTITUTION BROWSE ALL OPPORTUNITIES
# ============================================================

@app.get("/institution/{user_id}/opportunities/all")
def get_institution_all_opportunities(
    user_id: int,
    db: Session = Depends(get_db)
):
    try:
        require_institution(user_id, db)

        opportunities = db.execute(
            text("""
                SELECT
                    id,
                    title,
                    category,
                    suitable_major,
                    suitable_year,
                    difficulty,
                    required_skills,
                    skills_gained,
                    deadline,
                    estimated_time,
                    cv_benefit,
                    link,
                    hours_per_week,
                    institution_id,
                    source
                FROM opportunities
                WHERE deadline IS NULL
                    OR deadline >= CURRENT_DATE
                ORDER BY id
            """)
        ).mappings().all()

        return [
            dict(opportunity)
            for opportunity in opportunities
        ]

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve opportunities."
        )               


# ============================================================
# RECOMMENDATIONS
# ============================================================

@app.get("/student/{user_id}/recommendations")
def get_student_recommendations(
    user_id: int,
    db: Session = Depends(get_db)
):
    try:
        profile = db.execute(
            text("""
                SELECT
                    id,
                    user_id,
                    major,
                    year_of_study,
                    courses_taken,
                    current_skills,
                    interests,
                    career_goal,
                    available_time_per_week,
                    preferred_opportunity_type,
                    level
                FROM students
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found."
            )

        if profile["level"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Student profile must be analyzed "
                    "before recommendations."
                )
            )

        opportunities = db.execute(
            text("""
                SELECT
                    id,
                    title,
                    category,
                    suitable_major,
                    suitable_year,
                    difficulty,
                    required_skills,
                    skills_gained,
                    deadline,
                    estimated_time,
                    cv_benefit,
                    link,
                    hours_per_week
                FROM opportunities
                WHERE deadline IS NULL
                    OR deadline >= CURRENT_DATE
                ORDER BY id
            """)
        ).mappings().all()

        profile_dict = dict(profile)
        recommendations = []

        for opportunity in opportunities:
            opportunity_dict = dict(opportunity)

            match_score, reasons = score_opportunity(
                profile_dict,
                opportunity_dict
            )

            opportunity_dict["match_score"] = match_score
            opportunity_dict["reasons"] = reasons

            recommendations.append(opportunity_dict)

        recommendations.sort(
            key=lambda item: item["match_score"],
            reverse=True
        )

        return {
            "user_id": user_id,
            "recommendations": recommendations
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate recommendations."
        )


# ============================================================
# OPPORTUNITIES READ API
# ============================================================

@app.get("/opportunities")
def get_opportunities(
    category: str | None = None,
    difficulty: str | None = None,
    major: str | None = None,
    db: Session = Depends(get_db)
):
    query = """
        SELECT
            id,
            title,
            category,
            suitable_major,
            suitable_year,
            difficulty,
            required_skills,
            skills_gained,
            deadline,
            estimated_time,
            cv_benefit,
            link,
            hours_per_week
        FROM opportunities
    """

    conditions = [
        "(deadline IS NULL OR deadline >= CURRENT_DATE)"
    ]

    parameters = {}

    if category:
        conditions.append("category = :category")
        parameters["category"] = category

    if difficulty:
        conditions.append("difficulty = :difficulty")
        parameters["difficulty"] = difficulty

    if major:
        conditions.append(
            "(suitable_major = :major OR suitable_major = 'Any')"
        )
        parameters["major"] = major

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY id"

    opportunities = db.execute(
        text(query),
        parameters
    ).mappings().all()

    return [
        dict(opportunity)
        for opportunity in opportunities
    ]


@app.get("/opportunities/{opportunity_id}")
def get_opportunity_by_id(
    opportunity_id: int,
    db: Session = Depends(get_db)
):
    opportunity = db.execute(
        text("""
            SELECT
                id,
                title,
                category,
                suitable_major,
                suitable_year,
                difficulty,
                required_skills,
                skills_gained,
                deadline,
                estimated_time,
                cv_benefit,
                link,
                hours_per_week
            FROM opportunities
            WHERE id = :opportunity_id
                AND (
                    deadline IS NULL
                    OR deadline >= CURRENT_DATE
                )
        """),
        {"opportunity_id": opportunity_id}
    ).mappings().first()

    if opportunity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )

    return dict(opportunity)


# ============================================================
# FEATURE 4 / ISSUE #38
# AI opportunity processing
# ============================================================

@app.post("/institution/opportunities/process")
def process_opportunity_description(
    request: OpportunityProcessRequest,
    db: Session = Depends(get_db)
):
    # 404 if user does not exist.
    # 403 if user is not an institution.
    require_institution(request.user_id, db)

    description = request.description.strip()

    if not description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Opportunity description cannot be empty."
        )

    try:
        # Build Mufaro's extraction prompt.
        prompt = build_extraction_prompt(description)

        # Send prompt to Gemini.
        raw_ai_response = call_ai(prompt)

        # Parse and validate Gemini output.
        draft = extract_opportunity(raw_ai_response)

        # IMPORTANT:
        # This endpoint returns a draft only.
        # It does not save anything to PostgreSQL.
        return {
            "draft": draft
        }

    except Exception:
        # AI failure or invalid AI output must not produce a 500.
        fallback_title = (
            description.splitlines()[0][:255]
            if description.splitlines()
            else "Untitled Opportunity"
        )

        fallback_draft = {
            "title": fallback_title,
            "category": None,
            "difficulty": None,
            "suitable_major": None,
            "suitable_year": None,
            "required_skills": [],
            "skills_gained": [],
            "hours_per_week": None,
            "estimated_time": None,
            "cv_benefit": None,
            "link": None,
            "deadline": None
        }

        return {
            "draft": fallback_draft,
            "warning": (
                "AI processing was unavailable. "
                "Please review and complete the draft manually."
            )
        }


# ============================================================
# FEATURE 4 / ISSUE #38
# Save reviewed institution opportunity
# ============================================================

@app.post("/institution/opportunities")
def submit_institution_opportunity(
    opportunity: OpportunitySubmissionRequest,
    db: Session = Depends(get_db)
):
    try:
        # Make sure the user exists and is an institution.
        require_institution(opportunity.user_id, db)

        # opportunities.institution_id references institutions.id,
        # so find the institution profile belonging to this user.
        institution = db.execute(
            text("""
                SELECT id
                FROM institutions
                WHERE user_id = :user_id
            """),
            {"user_id": opportunity.user_id}
        ).mappings().fetchone()

        if institution is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Institution profile not found."
            )

        saved_opportunity = db.execute(
            text("""
                INSERT INTO opportunities (
                    title,
                    category,
                    suitable_major,
                    suitable_year,
                    difficulty,
                    required_skills,
                    skills_gained,
                    deadline,
                    estimated_time,
                    cv_benefit,
                    link,
                    hours_per_week,
                    institution_id,
                    source
                )
                VALUES (
                    :title,
                    :category,
                    :suitable_major,
                    :suitable_year,
                    :difficulty,
                    :required_skills,
                    :skills_gained,
                    :deadline,
                    :estimated_time,
                    :cv_benefit,
                    :link,
                    :hours_per_week,
                    :institution_id,
                    'institution'
                )
                RETURNING id
            """),
            {
                "title": opportunity.title,
                "category": opportunity.category,
                "suitable_major": opportunity.suitable_major,
                "suitable_year": opportunity.suitable_year,
                "difficulty": opportunity.difficulty,
                "required_skills": opportunity.required_skills,
                "skills_gained": opportunity.skills_gained,
                "deadline": opportunity.deadline,
                "estimated_time": opportunity.estimated_time,
                "cv_benefit": opportunity.cv_benefit,
                "link": opportunity.link,
                "hours_per_week": opportunity.hours_per_week,
                "institution_id": institution["id"]
            }
        ).fetchone()

        db.commit()

        return {
            "message": "Opportunity submitted successfully",
            "opportunity_id": saved_opportunity.id,
            "institution_id": institution["id"],
            "source": "institution"
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save opportunity."
        )


# ============================================================
# FEATURE 4 / ISSUE #38
# Generate or regenerate a student roadmap
# ============================================================

@app.post("/student/{user_id}/roadmap")
def generate_student_roadmap(
    user_id: int,
    db: Session = Depends(get_db)
):
    try:
        # Step 1:
        # Load the student's saved profile.
        profile = db.execute(
            text("""
                SELECT
                    id,
                    user_id,
                    major,
                    year_of_study,
                    courses_taken,
                    current_skills,
                    interests,
                    career_goal,
                    available_time_per_week,
                    preferred_opportunity_type,
                    level
                FROM students
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found."
            )

        # The recommendation system depends on the analyzed level,
        # so the roadmap should also require an analyzed profile.
        if profile["level"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Student profile must be analyzed "
                    "before generating a roadmap."
                )
            )

        profile_dict = dict(profile)

        # Step 2:
        # Load all active opportunities.
        opportunities = db.execute(
            text("""
                SELECT
                    id,
                    title,
                    category,
                    suitable_major,
                    suitable_year,
                    difficulty,
                    required_skills,
                    skills_gained,
                    deadline,
                    estimated_time,
                    cv_benefit,
                    link,
                    hours_per_week
                FROM opportunities
                WHERE deadline IS NULL
                    OR deadline >= CURRENT_DATE
                ORDER BY id
            """)
        ).mappings().all()

        # Step 3:
        # Score the opportunities using the existing recommendation logic.
        recommendations = []

        for opportunity in opportunities:
            opportunity_dict = dict(opportunity)

            match_score, reasons = score_opportunity(
                profile_dict,
                opportunity_dict
            )

            # Mufaro's roadmap functions accept this structure:
            # {
            #     "opportunity": {...},
            #     "score": ...,
            #     "reasons": [...]
            # }
            recommendations.append(
                {
                    "opportunity": opportunity_dict,
                    "score": match_score,
                    "reasons": reasons
                }
            )

        recommendations.sort(
            key=lambda item: item["score"],
            reverse=True
        )

        # Step 4:
        # Try generating the roadmap with Gemini.
        try:
            prompt = build_roadmap_prompt(
                profile_dict,
                recommendations
            )

            raw_ai_response = call_ai(prompt)

            roadmap = generate_roadmap(raw_ai_response)

        except Exception:
            # If Gemini fails, times out, or returns invalid JSON,
            # use Mufaro's rule-based fallback instead of returning 500.
            roadmap = fallback_roadmap(
                profile_dict,
                recommendations
            )

        # Mufaro's functions return source inside the roadmap.
        source = roadmap["source"]

        # The database already has a separate source column,
        # so only store the actual roadmap content in JSONB.
        roadmap_content = {
            "summary": roadmap["summary"],
            "milestones": roadmap["milestones"],
            "recommended_next_steps":
                roadmap["recommended_next_steps"]
        }

        # Step 5:
        # Save the newly generated roadmap.
        #
        # user_id is UNIQUE in roadmaps, so ON CONFLICT updates
        # the previous cached roadmap when POST is called again.
        db.execute(
            text("""
                INSERT INTO roadmaps (
                    user_id,
                    content,
                    source,
                    generated_at
                )
                VALUES (
                    :user_id,
                    CAST(:content AS JSONB),
                    :source,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (user_id)
                DO UPDATE SET
                    content = EXCLUDED.content,
                    source = EXCLUDED.source,
                    generated_at = CURRENT_TIMESTAMP
            """),
            {
                "user_id": user_id,
                "content": json.dumps(roadmap_content),
                "source": source
            }
        )

        db.commit()

        return {
            "user_id": user_id,
            "source": source,
            "roadmap": roadmap_content
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate roadmap."
        )


# ============================================================
# FEATURE 4 / ISSUE #38
# Get cached student roadmap
# ============================================================

@app.get("/student/{user_id}/roadmap")
def get_cached_student_roadmap(
    user_id: int,
    db: Session = Depends(get_db)
):
    try:
        roadmap = db.execute(
            text("""
                SELECT
                    user_id,
                    content,
                    source,
                    generated_at
                FROM roadmaps
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if roadmap is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roadmap not found."
            )

        return {
            "user_id": roadmap["user_id"],
            "source": roadmap["source"],
            "generated_at": roadmap["generated_at"],
            "roadmap": roadmap["content"]
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve roadmap."
        )