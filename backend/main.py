from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from auth import router as auth_router
from database import get_db
from schemas import StudentProfile

app = FastAPI(title="Skill+ Backend")

app.include_router(auth_router)


@app.get("/")
def root():
    return {"message": "Skill+ backend is running"}


@app.post("/student-profile")
def create_student_profile(profile: StudentProfile, db: Session = Depends(get_db)):
    try:
        new_profile = db.execute(
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
                "available_time_per_week": profile.available_time_per_week,
                "preferred_opportunity_type": profile.preferred_opportunity_type,
            }
        ).fetchone()

        db.commit()

        return {
            "message": "Student profile saved successfully",
            "student_id": new_profile.id
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