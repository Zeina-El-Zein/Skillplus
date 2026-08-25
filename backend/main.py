import json
from pathlib import Path
from uuid import uuid4
from sqlalchemy.exc import IntegrityError
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
    ReanalyzeRequest,
    StudentProfile,
    InstitutionProfile,
    OpportunityProcessRequest,
    OpportunitySubmissionRequest,
    TaskCreateRequest,
    TaskStatusUpdateRequest,
    TaskPriorityUpdateRequest,
)
from classification import analyze_profile
from scoring import score_opportunity, attach_opportunities_to_roadmap

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
# STUDENT TASKS
# ============================================================

@app.post(
    "/student/{user_id}/tasks",
    status_code=status.HTTP_201_CREATED
)
def create_student_task(
    user_id: int,
    task: TaskCreateRequest,
    db: Session = Depends(get_db)
):
    try:
        student = db.execute(
            text("""
                SELECT id
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

        student_id = student["id"]

        if task.source == "opportunity":
            if task.opportunity_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "opportunity_id is required "
                        "for opportunity tasks."
                    )
                )

            opportunity = db.execute(
                text("""
                    SELECT id
                    FROM opportunities
                    WHERE id = :opportunity_id
                """),
                {"opportunity_id": task.opportunity_id}
            ).fetchone()

            if opportunity is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Opportunity not found."
                )

            existing_task = db.execute(
                text("""
                    SELECT id
                    FROM student_tasks
                    WHERE student_id = :student_id
                      AND opportunity_id = :opportunity_id
                      AND source = 'opportunity'
                """),
                {
                    "student_id": student_id,
                    "opportunity_id": task.opportunity_id
                }
            ).fetchone()

            if existing_task is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "This opportunity is already "
                        "in your To-Do list."
                    )
                )

        created_task = db.execute(
            text("""
                INSERT INTO student_tasks (
                    student_id,
                    title,
                    description,
                    status,
                    priority,
                    opportunity_id,
                    source
                )
                VALUES (
                    :student_id,
                    :title,
                    :description,
                    'todo',
                    :priority,
                    :opportunity_id,
                    :source
                )
                RETURNING
                    id,
                    student_id,
                    title,
                    description,
                    status,
                    priority,
                    opportunity_id,
                    source,
                    created_at,
                    updated_at,
                    completed_at
            """),
            {
                "student_id": student_id,
                "title": task.title,
                "description": task.description,
                "priority": task.priority,
                "opportunity_id": task.opportunity_id,
                "source": task.source
            }
        ).mappings().fetchone()

        if task.source == "opportunity":
            db.execute(
                text("""
                    INSERT INTO opportunity_interactions (
                        opportunity_id,
                        student_id,
                        interaction_type
                    )
                    VALUES (
                        :opportunity_id,
                        :student_id,
                        'added_to_todo'
                    )
                """),
                {
                    "opportunity_id": task.opportunity_id,
                    "student_id": student_id
                }
            )


        db.commit()

        return {
            "message": "Task added to To-Do successfully.",
            "task": dict(created_task)
        }

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError as e:
        db.rollback()

        if (
            getattr(e.orig, "pgcode", None) == "23505"
            and getattr(
                getattr(e.orig, "diag", None),
                "constraint_name",
                None
            ) == "unique_student_opportunity"
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This opportunity is already in your To-Do list."
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create task because of a database constraint."
        )

    except Exception as e:
        db.rollback()
        print("CREATE TASK ERROR:", repr(e))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create task."
        )


@app.get("/student/{user_id}/tasks")
def get_student_tasks(
    user_id: int,
    task_status: str | None = None,
    db: Session = Depends(get_db)
):
    try:
        student = db.execute(
            text("""
                SELECT id
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

        query = """
            SELECT
                id,
                student_id,
                title,
                description,
                status,
                priority,
                opportunity_id,
                source,
                created_at,
                updated_at,
                completed_at
            FROM student_tasks
            WHERE student_id = :student_id
        """

        parameters = {
            "student_id": student["id"]
        }

        if task_status is not None:
            if task_status not in {
                "todo",
                "in_progress",
                "done"
            }:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid task status."
                )

            query += " AND status = :task_status"
            parameters["task_status"] = task_status

        query += " ORDER BY created_at DESC"

        tasks = db.execute(
            text(query),
            parameters
        ).mappings().all()

        return {
            "user_id": user_id,
            "tasks": [
                dict(task)
                for task in tasks
            ]
        }

    except HTTPException:
        raise

    except Exception as e:
        print("GET TASKS ERROR:", repr(e))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve student tasks."
        )

#this endpoint  allows updating the task status from todo -> in progress -> done 
@app.patch("/student/{user_id}/tasks/{task_id}/status")
def update_task_status(
    user_id: int,
    task_id: int,
    update: TaskStatusUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        student = db.execute(
            text("""
                SELECT id
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

        existing_task = db.execute(
            text("""
                SELECT id
                FROM student_tasks
                WHERE id = :task_id
                  AND student_id = :student_id
            """),
            {
                "task_id": task_id,
                "student_id": student["id"]
            }
        ).fetchone()

        if existing_task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found."
            )

        completed_at = (
            "CURRENT_TIMESTAMP"
            if update.status == "done"
            else "NULL"
        )

        updated_task = db.execute(
            text(f"""
                UPDATE student_tasks
                SET
                    status = :status,
                    updated_at = CURRENT_TIMESTAMP,
                    completed_at = {completed_at}
                WHERE id = :task_id
                  AND student_id = :student_id
                RETURNING
                    id,
                    student_id,
                    title,
                    description,
                    status,
                    priority,
                    opportunity_id,
                    source,
                    created_at,
                    updated_at,
                    completed_at
            """),
            {
                "status": update.status,
                "task_id": task_id,
                "student_id": student["id"]
            }
        ).mappings().fetchone()

        db.commit()

        return {
            "message": "Task status updated successfully.",
            "task": dict(updated_task)
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()
        print("UPDATE TASK STATUS ERROR:", repr(e))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update task status."
        )

# 1. Find the student using user_id
# 2. Make sure the task belongs to that student
# 3. UPDATE the priority
# 4. Commit
# 5. Return the updated task
@app.patch("/student/{user_id}/tasks/{task_id}/priority")
def update_task_priority(
    user_id: int,
    task_id: int,
    update: TaskPriorityUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        student = db.execute(
            text("""
                SELECT id
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

        existing_task = db.execute(
            text("""
                SELECT id
                FROM student_tasks
                WHERE id = :task_id
                  AND student_id = :student_id
            """),
            {
                "task_id": task_id,
                "student_id": student["id"]
            }
        ).fetchone()

        if existing_task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found."
            )

        updated_task = db.execute(
            text("""
                UPDATE student_tasks
                SET
                    priority = :priority,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :task_id
                  AND student_id = :student_id
                RETURNING
                    id,
                    student_id,
                    title,
                    description,
                    status,
                    priority,
                    opportunity_id,
                    source,
                    created_at,
                    updated_at,
                    completed_at
            """),
            {
                "priority": update.priority,
                "task_id": task_id,
                "student_id": student["id"]
            }
        ).mappings().fetchone()

        db.commit()

        return {
            "message": "Task priority updated successfully.",
            "task": dict(updated_task)
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()
        print("UPDATE TASK PRIORITY ERROR:", repr(e))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not update task priority."
        )


@app.delete("/student/{user_id}/tasks/{task_id}")
def delete_student_task(
    user_id: int,
    task_id: int,
    db: Session = Depends(get_db)
):
    try:
        student = db.execute(
            text("""
                SELECT id
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

        existing_task = db.execute(
            text("""
                SELECT id
                FROM student_tasks
                WHERE id = :task_id
                  AND student_id = :student_id
            """),
            {
                "task_id": task_id,
                "student_id": student["id"]
            }
        ).fetchone()

        if existing_task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found."
            )

        db.execute(
            text("""
                DELETE FROM student_tasks
                WHERE id = :task_id
                  AND student_id = :student_id
            """),
            {
                "task_id": task_id,
                "student_id": student["id"]
            }
        )

        db.commit()

        return {
            "message": "Task removed successfully."
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()
        print("DELETE TASK ERROR:", repr(e))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not remove task."
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
                    o.id,
                    o.title,
                    o.category,
                    o.suitable_major,
                    o.suitable_year,
                    o.difficulty,
                    o.required_skills,
                    o.skills_gained,
                    o.deadline,
                    o.estimated_time,
                    o.cv_benefit,
                    o.link,
                    o.hours_per_week,
                    o.institution_id,
                    o.source,
                    o.created_at,
                    COUNT(DISTINCT CASE WHEN i.interaction_type = 'view'
                            THEN i.student_id END) AS views,
                    COUNT(DISTINCT CASE WHEN i.interaction_type = 'added_to_todo'
                            THEN i.student_id END) AS added_to_todo
                FROM opportunities o
                LEFT JOIN opportunity_interactions i
                        ON i.opportunity_id = o.id
                WHERE o.institution_id = :institution_id
                GROUP BY o.id
                ORDER BY o.id
            """),
            {"institution_id": institution["id"]}
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

        source = roadmap["source"]

        roadmap_content = {
            "summary": roadmap["summary"],
            "steps": roadmap["steps"]
        }

        # Step 5:
        # Save the newly generated roadmap.
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

        profile_dict = dict(profile)

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

        opportunity_dicts = [dict(o) for o in opportunities]

        roadmap_with_opportunities = attach_opportunities_to_roadmap(
            roadmap["content"],
            profile_dict,
            opportunity_dicts
        )

        for step in roadmap_with_opportunities.get("steps", []):
            task_id = step.get("task_id")

            if task_id is None:
                step["task_status"] = None
                continue

            linked_task = db.execute(
                text("""
                    SELECT status
                    FROM student_tasks
                    WHERE id = :task_id
                      AND student_id = :student_id
                """),
                {"task_id": task_id, "student_id": profile["id"]}
            ).mappings().fetchone()

            step["task_status"] = (
                linked_task["status"] if linked_task is not None else None
            )

        return {
            "user_id": roadmap["user_id"],
            "source": roadmap["source"],
            "generated_at": roadmap["generated_at"],
            "roadmap": roadmap_with_opportunities
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve roadmap."
        )

# ============================================================
# FEATURE 4 / ISSUE #38
# Link a roadmap step to a real student_tasks record
# ============================================================

@app.post("/student/{user_id}/roadmap/steps/{order}/create-task")
def create_task_from_roadmap_step(
    user_id: int,
    order: int,
    db: Session = Depends(get_db)
):
    try:
        # Step 1:
        # Find the student (student_tasks.student_id references
        # students.id, not users.id).
        student = db.execute(
            text("""
                SELECT id
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

        student_id = student["id"]

        # Step 2:
        # Load the cached roadmap. roadmaps.user_id references users.id
        # directly (unlike student_tasks), so this lookup uses user_id.
        roadmap_row = db.execute(
            text("""
                SELECT content
                FROM roadmaps
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()

        if roadmap_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roadmap not found."
            )

        roadmap_content = roadmap_row["content"]
        steps = roadmap_content.get("steps", [])

        # Step 3:
        # Find the target step by its order value.
        target_step = None
        target_index = None
        for index, step in enumerate(steps):
            if step.get("order") == order:
                target_step = step
                target_index = index
                break

        if target_step is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Roadmap step not found."
            )

        # Step 4:
        # A step can only be linked to one task. If it already has a
        # task_id, do not silently create a second student_tasks row --
        # that would orphan the first one and desync progress.
        if target_step.get("task_id") is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This roadmap step is already linked to a task."
            )

        # Step 5:
        # Create the student_tasks row from the step's fields.opportunity_id is left NULL -- a roadmap-sourced task is not
        # itself an application to a specific opportunity, it's a
        # skill-building step. (The unique_student_opportunity
        # constraint allows multiple NULL opportunity_id rows per
        # student, since Postgres treats NULLs as distinct for
        # uniqueness purposes.)
        created_task = db.execute(
            text("""
                INSERT INTO student_tasks (
                    student_id,
                    title,
                    description,
                    status,
                    priority,
                    opportunity_id,
                    source
                )
                VALUES (
                    :student_id,
                    :title,
                    :description,
                    'todo',
                    :priority,
                    NULL,
                    'roadmap'
                )
                RETURNING
                    id,
                    student_id,
                    title,
                    description,
                    status,
                    priority,
                    opportunity_id,
                    source,
                    created_at,
                    updated_at,
                    completed_at
            """),
            {
                "student_id": student_id,
                "title": target_step["title"],
                "description": target_step.get("description"),
                "priority": target_step.get("priority", "medium")
            }
        ).mappings().fetchone()

        # Step 6:
        # Write the new task's id back into the step, then save the
        # whole roadmap content back to the roadmaps table.
        steps[target_index]["task_id"] = created_task["id"]
        roadmap_content["steps"] = steps

        db.execute(
            text("""
                UPDATE roadmaps
                SET content = CAST(:content AS JSONB)
                WHERE user_id = :user_id
            """),
            {
                "content": json.dumps(roadmap_content),
                "user_id": user_id
            }
        )

        db.commit()

        return {
            "message": "Task created and linked to roadmap step.",
            "task": dict(created_task),
            "step": steps[target_index]
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()
        print("CREATE TASK FROM ROADMAP STEP ERROR:", repr(e))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create task from roadmap step."
        )


@app.post("/student/{user_id}/reanalyze")
def reanalyze_student(
    user_id: int,
    request: ReanalyzeRequest,
    db: Session = Depends(get_db)
):
    try:
        # Step 1:
        # Load the current profile (same fields used by analyze/roadmap).
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
 
        # Step 2:
        # Re-run level classification against the latest profile fields,
        # same rules as POST /student/analyze/{user_id}, and persist the
        # (possibly unchanged) result.
        courses = len(profile["courses_taken"] or [])
        skills = len(profile["current_skills"] or [])
        year = profile["year_of_study"] or 0
 
        classification = analyze_profile(
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
                "level": classification.level,
                "user_id": user_id
            }
        )
 
        profile_dict = dict(profile)
        profile_dict["level"] = classification.level
 
        # Step 3:
        # Load active opportunities and score them -- identical to the
        # roadmap endpoint, so recommendations stay consistent across
        # both flows.
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
 
        opportunity_dicts = [dict(o) for o in opportunities]
 
        recommendations = []
        for opportunity_dict in opportunity_dicts:
            match_score, reasons = score_opportunity(
                profile_dict,
                opportunity_dict
            )
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
        # Find which steps of the *existing* cached roadmap (if any)
        # should be preserved -- those linked to a task that is done.
        preserved_steps = []
 
        existing_roadmap_row = db.execute(
            text("""
                SELECT content
                FROM roadmaps
                WHERE user_id = :user_id
            """),
            {"user_id": user_id}
        ).mappings().fetchone()
 
        if existing_roadmap_row is not None:
            existing_steps = existing_roadmap_row["content"].get("steps", [])
 
            for step in existing_steps:
                task_id = step.get("task_id")
                if task_id is None:
                    continue
 
                linked_task = db.execute(
                    text("""
                        SELECT status
                        FROM student_tasks
                        WHERE id = :task_id
                          AND student_id = (
                              SELECT id FROM students WHERE user_id = :user_id
                          )
                    """),
                    {"task_id": task_id, "user_id": user_id}
                ).mappings().fetchone()
 
                if linked_task is not None and linked_task["status"] == "done":
                    preserved_steps.append(step)
 
        # Step 5:
        # Generate a fresh roadmap the same way POST /roadmap does.
        try:
            prompt = build_roadmap_prompt(profile_dict, recommendations)
            raw_ai_response = call_ai(prompt)
            new_roadmap = generate_roadmap(raw_ai_response)
        except Exception:
            new_roadmap = fallback_roadmap(profile_dict, recommendations)
 
        source = new_roadmap["source"]
 
        # Step 6:
        # Merge preserved (completed) steps with the freshly generated
        # ones. Preserved steps come first so completed progress stays
        # visible at the front of the timeline, then the new steps
        # follow. Order values are renumbered so the merged list is
        # always a clean 1..N sequence.
        merged_steps = preserved_steps + new_roadmap["steps"]
        for position, step in enumerate(merged_steps, start=1):
            step["order"] = position
 
        roadmap_content = {
            "summary": new_roadmap["summary"],
            "steps": merged_steps
        }
 
        # Step 7:
        # Save the merged roadmap as the new cache.
        saved_roadmap = db.execute(
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
                RETURNING generated_at
            """),
            {
                "user_id": user_id,
                "content": json.dumps(roadmap_content),
                "source": source
            }
        ).mappings().fetchone()
 
        db.commit()
 
        # Step 8:
        # Refresh recommendations/opportunities live in the response,
        # same as GET /roadmap -- never cached, always computed against
        # the current opportunity list.
        roadmap_with_opportunities = attach_opportunities_to_roadmap(
            roadmap_content,
            profile_dict,
            opportunity_dicts
        )
 
        return {
            "user_id": user_id,
            "level": classification.level,
            "source": source,
            "roadmap": roadmap_with_opportunities,
            "trigger": request.trigger,
            "updated_at": saved_roadmap["generated_at"]
        }
 
    except HTTPException:
        db.rollback()
        raise
 
    except Exception as e:
        db.rollback()
        print("REANALYZE ERROR:", repr(e))
 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not reanalyze student profile."
        )

@app.post("/opportunities/{opportunity_id}/view")
def record_opportunity_view(
    opportunity_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Records that a student opened an opportunity's details.

    Called by the frontend when the detail view is opened, not when the
    opportunity merely appears in a list. Used only for aggregated
    institution statistics.
    """
    try:
        student = db.execute(
            text("SELECT id FROM students WHERE user_id = :user_id"),
            {"user_id": user_id}
        ).mappings().fetchone()

        if student is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student profile not found."
            )

        opportunity = db.execute(
            text("SELECT id FROM opportunities WHERE id = :id"),
            {"id": opportunity_id}
        ).fetchone()

        if opportunity is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Opportunity not found."
            )

        db.execute(
            text("""
                INSERT INTO opportunity_interactions
                    (opportunity_id, student_id, interaction_type)
                VALUES (:opportunity_id, :student_id, 'view')
            """),
            {"opportunity_id": opportunity_id, "student_id": student["id"]}
        )
        db.commit()

        return {"message": "View recorded"}

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not record opportunity view."
        )