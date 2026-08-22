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


class OpportunityProcessRequest(BaseModel):
    user_id: int
    description: str


class OpportunitySubmissionRequest(BaseModel):
    user_id: int
    title: str

    category: Literal[
        "Internship",
        "Project",
        "Workshop",
        "Bootcamp",
        "Hackathon",
        "Competition",
        "Mentorship",
        "Research"
    ]

    difficulty: Literal[
        "Beginner",
        "Intermediate",
        "Advanced"
    ]

    suitable_major: Literal[
        "Computer and Communications Engineering",
        "Computer Science",
        "Electrical Engineering",
        "Mechanical Engineering",
        "Civil Engineering",
        "Industrial Engineering",
        "Chemical Engineering",
        "Other",
        "Any"
    ]

    suitable_year: int | None = None
    required_skills: list[str]
    skills_gained: list[str] = []
    hours_per_week: int | None = None
    estimated_time: str | None = None
    cv_benefit: str | None = None
    link: str | None = None
    deadline: str | None = None

class TaskCreateRequest(BaseModel):
    title: str
    description: str | None = None
    priority: Literal["high", "medium", "low"] = "medium"
    opportunity_id: int | None = None
    roadmap_step_id: int | None = None
    source: Literal["opportunity", "roadmap"]

class TaskStatusUpdateRequest(BaseModel):
    status: Literal["todo", "in_progress", "done"]


class TaskPriorityUpdateRequest(BaseModel):
    priority: Literal["high", "medium", "low"]