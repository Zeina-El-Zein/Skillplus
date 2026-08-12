from pydantic import BaseModel, EmailStr, Field
from typing import Literal

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["student", "institution"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20)
    new_password: str = Field(min_length=6)

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

class InstitutionProfile(BaseModel):
    user_id: int
    institution_name: str
    website: str | None = None
    description: str | None = None