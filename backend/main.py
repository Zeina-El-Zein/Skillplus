from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from auth import router as auth_router
from database import get_db
from schemas import StudentProfile
from classification import analyze_profile

app = FastAPI(title="Skill+ Backend")
from fastapi.middleware.cors import CORSMiddleware

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
def analyze_student(user_id: int, db: Session = Depends(get_db)):
    try:
        profile = db.execute(
            text("""
                SELECT year_of_study, courses_taken, current_skills
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

        result = analyze_profile(year=year, courses=courses, skills=skills)

        db.execute(
            text("UPDATE students SET level = :level WHERE user_id = :user_id"),
            {"level": result.level, "user_id": user_id}
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