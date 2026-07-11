"""
Student level classification (Issue 1 / Issue 12).

Replaces the vague "AI analyzes the profile" idea with explicit,
testable rules.

Rules (checked in order — first match wins):
    1. courses >= 8 AND skills >= 6           -> Advanced
    2. courses >= 5 OR  skills >= 4            -> Intermediate
    3. year == 1 AND courses < 5 AND skills < 3 -> Beginner
    4. anything else                           -> Intermediate (fallback)

Experience thresholds are checked BEFORE the year-based Beginner rule,
so a Year 1 student with enough courses/skills is never capped at
Beginner just because of their year.
"""

from dataclasses import dataclass, field
from typing import List


ADVANCED_COURSES = 8
ADVANCED_SKILLS = 6

INTERMEDIATE_COURSES = 5
INTERMEDIATE_SKILLS = 4

BEGINNER_MAX_COURSES = 5   # "fewer than 5" -> < 5
BEGINNER_MAX_SKILLS = 3    # "fewer than 3" -> < 3


@dataclass
class ClassificationResult:
    level: str
    strengths: List[str] = field(default_factory=list)
    missing: List[str] = field(default_factory=list)
    next_step: str = ""


def classify_level(year: int, courses: int, skills: int) -> str:
    """Return just the level string: 'Beginner' | 'Intermediate' | 'Advanced'."""
    if courses >= ADVANCED_COURSES and skills >= ADVANCED_SKILLS:
        return "Advanced"

    if courses >= INTERMEDIATE_COURSES or skills >= INTERMEDIATE_SKILLS:
        return "Intermediate"

    if year == 1 and courses < BEGINNER_MAX_COURSES and skills < BEGINNER_MAX_SKILLS:
        return "Beginner"

    # Fallback: e.g. a Year 2+ student who hasn't hit Intermediate or
    # Beginner thresholds. Not covered explicitly by Issue 1 — flagged
    # there as an open question for the team.
    return "Intermediate"


def analyze_profile(year: int, courses: int, skills: int) -> ClassificationResult:
    """
    Return level plus supporting details (Issue 2 acceptance criteria:
    strengths / missing skills / next step, "if time allows").

    Missing/next-step are computed relative to the gap to the NEXT tier,
    since the platform doesn't yet track which specific skills are
    "required" (that lives on the Opportunity side, Feature 2/3).
    """
    level = classify_level(year, courses, skills)

    strengths = []
    if courses > 0:
        strengths.append(f"{courses} course(s) completed")
    if skills > 0:
        strengths.append(f"{skills} skill(s) acquired")

    missing: List[str] = []
    next_step = ""

    if level == "Beginner":
        need_courses = max(0, INTERMEDIATE_COURSES - courses)
        need_skills = max(0, INTERMEDIATE_SKILLS - skills)
        if need_courses:
            missing.append(f"{need_courses} more course(s) to reach Intermediate")
        if need_skills:
            missing.append(f"{need_skills} more skill(s) to reach Intermediate")
        next_step = "Focus on foundational courses and building your first skills."

    elif level == "Intermediate":
        need_courses = max(0, ADVANCED_COURSES - courses)
        need_skills = max(0, ADVANCED_SKILLS - skills)
        if need_courses:
            missing.append(f"{need_courses} more course(s) to reach Advanced")
        if need_skills:
            missing.append(f"{need_skills} more skill(s) to reach Advanced")
        next_step = "Keep building breadth — a few more courses/skills unlocks Advanced."

    else:  # Advanced
        next_step = "You're internship-ready — start applying to internship opportunities."

    return ClassificationResult(
        level=level,
        strengths=strengths,
        missing=missing,
        next_step=next_step,
    )
