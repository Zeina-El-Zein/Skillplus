"""
Issue 2: /student/analyze endpoint.

Proposal for Member 3: a SEPARATE endpoint from POST /student/profile,
so profile creation/update and analysis are independently testable and
callable. This is a suggestion, not a locked decision — swap the route
handler body into wherever /student/profile lives if the team prefers
auto-triggering instead.
"""

from fastapi import FastAPI
from pydantic import BaseModel

from classification import analyze_profile

app = FastAPI()


class ProfileInput(BaseModel):
    year: int
    courses: int
    skills: int


class AnalyzeResponse(BaseModel):
    level: str
    strengths: list[str]
    missing: list[str]
    next_step: str


@app.post("/student/analyze", response_model=AnalyzeResponse)
def analyze(profile: ProfileInput):
    result = analyze_profile(profile.year, profile.courses, profile.skills)
    return AnalyzeResponse(
        level=result.level,
        strengths=result.strengths,
        missing=result.missing,
        next_step=result.next_step,
    )
