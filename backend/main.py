from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import psycopg2

app = FastAPI()
def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        database="skillplus",
        user="postgres",
        password="admin123"
    )


class StudentProfile(BaseModel):
    user_id: int
    major: str
    year_of_study: int
    courses_taken: List[str]
    current_skills: List[str]
    interests: List[str]
    career_goal: str
    available_time_per_week: int
    preferred_opportunity_type: str


@app.get("/")
def home():
    return {"message": "Skill+ backend is running"}

@app.post("/student-profile")
def create_student_profile(profile: StudentProfile):
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
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
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                profile.user_id,
                profile.major,
                profile.year_of_study,
                profile.courses_taken,
                profile.current_skills,
                profile.interests,
                profile.career_goal,
                profile.available_time_per_week,
                profile.preferred_opportunity_type
            )
        )

        student_id = cur.fetchone()[0]
        conn.commit()

        return {
            "message": "Student profile saved successfully",
            "student_id": student_id
        }

    except psycopg2.errors.ForeignKeyViolation:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=400,
            detail="User not found. Please use an existing user_id."
        )

    except Exception:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save student profile."
        )

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()