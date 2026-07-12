from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    
class StudentProfile(BaseModel):
    user_id: int
    major: str
    year_of_study: int
    courses_taken: list[str]
    current_skills: list[str]
    interests: list[str]
    career_goal: str
    available_time_per_week: int
    preferred_opportunity_type: str