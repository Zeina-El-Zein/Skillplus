from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from authorization import require_institution
from auth import router as auth_router
from database import get_db
from schemas import StudentProfile, InstitutionProfile
from classification import analyze_profile
from scoring import score_opportunity


app = FastAPI(title="Skill+ Backend")

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
            "level": profile["level"]
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve student profile."
        )


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

@app.post("/institution-profile")
def create_institution_profile(
    profile: InstitutionProfile,
    db: Session = Depends(get_db)
):
    try:
        # Make sure the user exists and is actually an institution by calling the function from authorization.py
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
                description
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