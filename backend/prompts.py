"""
AI integration layer: prompt construction, output contracts, and validation
for the two AI-backed features:

  1. Extraction  — turn a pasted opportunity description into structured
     fields that match scoring.py's contract (see EXTRACTION_SCHEMA).
  2. Roadmap     — turn a student profile + their scored recommendations
     into a personalized roadmap (see ROADMAP_SCHEMA).

Both prompts demand strict JSON and nothing else. Nothing here trusts the
model: every response is parsed and validated against the schema before
it's allowed to touch the rest of the app. If validation fails, or the AI
call fails/is disabled, `fallback_roadmap()` produces a roadmap with no AI
call at all (rules-based: level + missing skills + top recommendations).

Note: this module owns the reasoning layer (prompts, schemas, validation,
fallback). Wiring the actual Gemini client is tracked separately (blocked
on the API key per this week's issue); `call_ai_fn` below is injected so
that piece can be swapped in without touching this file.

CANONICAL VALUES: DIFFICULTY_LEVELS, CATEGORIES, and CANONICAL_MAJORS below
are the single source of truth shared with the profile form dropdown and
backend/seed.sql. Do not add, remove, or rename values here without
telling the team -- these three lists must stay byte-identical across all
three places.
"""

import json
import re

# ---------------------------------------------------------------------------
# Canonical contracts (must match scoring.py's expectations exactly)
# ---------------------------------------------------------------------------

DIFFICULTY_LEVELS = ["Beginner", "Intermediate", "Advanced"]

# Exactly 8 categories (students.preferred_opportunity_type / opportunities.category)
CATEGORIES = [
    "Internship",
    "Project",
    "Workshop",
    "Bootcamp",
    "Hackathon",
    "Competition",
    "Mentorship",
    "Research",
]

# Canonical majors (students.major / opportunities.suitable_major).
# "Any" is accepted in addition to this list wherever suitable_major is
# used (opportunity open to every major) -- but is NOT a valid value for
# students.major.
CANONICAL_MAJORS = [
    "Computer and Communications Engineering",
    "Computer Science",
    "Electrical Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Industrial Engineering",
    "Chemical Engineering",
    "Other",
]
ALLOWED_MAJOR_VALUES = CANONICAL_MAJORS + ["Any"]


class PromptValidationError(Exception):
    """Raised when AI output fails to parse or violates the schema contract."""


# ---------------------------------------------------------------------------
# 1. Extraction prompt + schema
# ---------------------------------------------------------------------------

EXTRACTION_SCHEMA = {
    "type": "object",
    "required": [
        "title",
        "category",
        "difficulty",
        "suitable_major",
        "required_skills",
    ],
    "properties": {
        "title": {"type": "string"},
        "category": {"type": "string", "enum": CATEGORIES},
        "difficulty": {"type": "string", "enum": DIFFICULTY_LEVELS},
        "suitable_major": {"type": "string", "enum": ALLOWED_MAJOR_VALUES},
        "suitable_year": {
            # opportunities.suitable_year is a single INTEGER column, not
            # an array -- one year, or null if open to any/unspecified.
            "anyOf": [{"type": "integer"}, {"type": "null"}]
        },
        "required_skills": {"type": "array", "items": {"type": "string"}},
        "skills_gained": {"type": "array", "items": {"type": "string"}},
        "hours_per_week": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "estimated_time": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "cv_benefit": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "link": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "deadline": {"anyOf": [{"type": "string"}, {"type": "null"}]},
    },
    "additionalProperties": False,
}


def build_extraction_prompt(description: str) -> str:
    """Builds the prompt that extracts structured opportunity fields from
    a pasted description. Output must be strict JSON matching
    EXTRACTION_SCHEMA -- no markdown fences, no commentary.

    Field set mirrors the `opportunities` table columns exactly
    (backend/schema.sql). There is no career_goals column -- career-goal
    relevance is inferred at scoring time by matching a student's
    career_goal against title/category/skills_gained/cv_benefit, so it is
    not part of this contract. institution_id and source are set by the
    submission endpoint, not by the model."""
    return f"""You are an information-extraction engine. Read the opportunity
description below and extract structured fields.

Respond with STRICT JSON ONLY. No markdown code fences, no preamble, no
explanation, no trailing text -- the response must start with {{ and end
with }} and be directly parseable by json.loads().

Return an object with exactly these fields:
- "title": string, the opportunity's title.
- "category": string, MUST be exactly one of: {CATEGORIES}
- "difficulty": string, MUST be exactly one of: {DIFFICULTY_LEVELS}
- "suitable_major": string, MUST be exactly one of: {CANONICAL_MAJORS}, or
  the literal string "Any" if the opportunity is open to every major.
- "suitable_year": a single integer (e.g. 2) if the opportunity targets
  one specific year of study, or null if it's open to any year or not
  mentioned. This is a single value, never a list.
- "required_skills": a JSON array of strings -- skills/tools required or
  strongly preferred to apply. Use [] if none are mentioned.
- "skills_gained": a JSON array of strings -- skills the student would
  gain/develop by doing this opportunity. Use [] if none are evident.
- "hours_per_week": an integer (hours per week expected), or null if
  self-paced or not mentioned.
- "estimated_time": a short free-text duration (e.g. "3 months",
  "Ongoing", "Self-paced"), or null if not mentioned.
- "cv_benefit": a short string describing why this strengthens a CV, or
  null if not evident from the text.
- "link": a URL string if one appears in the text, otherwise null.
- "deadline": an ISO date string "YYYY-MM-DD" if a deadline is mentioned,
  otherwise null (e.g. self-paced/rolling opportunities have no deadline).

Do not invent values. If a field is not present or cannot be inferred
from the text, use null (or [] for array fields, except suitable_major,
difficulty, and category, which are required and must always be your
best single-value guess from the allowed lists above).

Do not output any value outside the allowed lists above for category,
difficulty, or suitable_major -- if uncertain, choose the closest allowed
value, never invent a new one.

Opportunity description:
\"\"\"
{description}
\"\"\"
"""


def validate_extraction(data) -> dict:
    """Validates a parsed extraction response against EXTRACTION_SCHEMA.
    Raises PromptValidationError on any contract violation. Returns the
    validated dict on success (with optional fields defaulted)."""
    if not isinstance(data, dict):
        raise PromptValidationError("Extraction output must be a JSON object")

    for field in EXTRACTION_SCHEMA["required"]:
        if field not in data:
            raise PromptValidationError(f"Missing required field: {field}")

    allowed_keys = set(EXTRACTION_SCHEMA["properties"].keys())
    unknown = set(data.keys()) - allowed_keys
    if unknown:
        raise PromptValidationError(f"Unexpected field(s): {sorted(unknown)}")

    if not isinstance(data.get("title"), str) or not data["title"].strip():
        raise PromptValidationError("'title' must be a non-empty string")

    if data.get("category") not in CATEGORIES:
        raise PromptValidationError(
            f"'category' must be one of {CATEGORIES}, got {data.get('category')!r}"
        )

    if data.get("difficulty") not in DIFFICULTY_LEVELS:
        raise PromptValidationError(
            f"'difficulty' must be one of {DIFFICULTY_LEVELS}, "
            f"got {data.get('difficulty')!r}"
        )

    if data.get("suitable_major") not in ALLOWED_MAJOR_VALUES:
        raise PromptValidationError(
            f"'suitable_major' must be one of {ALLOWED_MAJOR_VALUES}, "
            f"got {data.get('suitable_major')!r}"
        )

    suitable_year = data.get("suitable_year")
    if suitable_year is not None and not isinstance(suitable_year, int):
        # opportunities.suitable_year is a single INTEGER column.
        raise PromptValidationError(
            "'suitable_year' must be a single integer or null (not a list)"
        )

    required_skills = data.get("required_skills")
    if not isinstance(required_skills, list) or not all(
        isinstance(s, str) for s in required_skills
    ):
        raise PromptValidationError("'required_skills' must be a list of strings")

    skills_gained = data.get("skills_gained", [])
    if not isinstance(skills_gained, list) or not all(
        isinstance(s, str) for s in skills_gained
    ):
        raise PromptValidationError("'skills_gained' must be a list of strings")

    hours_per_week = data.get("hours_per_week")
    if hours_per_week is not None and not isinstance(hours_per_week, int):
        raise PromptValidationError("'hours_per_week' must be an integer or null")

    for field in ("estimated_time", "cv_benefit", "link", "deadline"):
        value = data.get(field)
        if value is not None and not isinstance(value, str):
            raise PromptValidationError(f"'{field}' must be a string or null")

    # Defaults for optional fields not always emitted by the model.
    data.setdefault("suitable_year", None)
    data.setdefault("skills_gained", [])
    data.setdefault("hours_per_week", None)
    data.setdefault("estimated_time", None)
    data.setdefault("cv_benefit", None)
    data.setdefault("link", None)
    data.setdefault("deadline", None)

    return data


# ---------------------------------------------------------------------------
# 2. Roadmap prompt + schema
# ---------------------------------------------------------------------------

ROADMAP_SCHEMA = {
    "type": "object",
    "required": ["summary", "milestones", "recommended_next_steps"],
    "properties": {
        "summary": {"type": "string"},
        "milestones": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["title", "description", "skills_to_learn"],
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "skills_to_learn": {"type": "array", "items": {"type": "string"}},
                    "suggested_timeframe": {"type": "string"},
                },
            },
        },
        "recommended_next_steps": {"type": "array", "items": {"type": "string"}},
    },
    "additionalProperties": False,
}


def build_roadmap_prompt(profile: dict, recommendations: list) -> str:
    """Builds the prompt that generates a personalized roadmap from a
    student profile and their top scored recommendations. Output must be
    strict JSON matching ROADMAP_SCHEMA -- no markdown fences, no
    commentary."""
    top = recommendations[:5]
    rec_summaries = []
    for rec in top:
        opp = rec.get("opportunity", rec)
        rec_summaries.append(
            {
                "title": opp.get("title"),
                "category": opp.get("category"),
                "difficulty": opp.get("difficulty"),
                "required_skills": opp.get("required_skills", []),
                "skills_gained": opp.get("skills_gained", []),
                "cv_benefit": opp.get("cv_benefit"),
                "score": rec.get("score"),
            }
        )

    return f"""You are a career/academic advisor. Build a personalized
roadmap for the student described below, using their profile and their
top matched opportunities.

Respond with STRICT JSON ONLY. No markdown code fences, no preamble, no
explanation, no trailing text -- the response must start with {{ and end
with }} and be directly parseable by json.loads().

Student profile:
{json.dumps(profile, default=str)}

Top matched opportunities (already scored by our system):
{json.dumps(rec_summaries, default=str)}

Return an object with exactly these fields:
- "summary": string, 2-3 sentences summarizing the roadmap's focus.
- "milestones": a JSON array of milestone objects, each with:
    - "title": string
    - "description": string
    - "skills_to_learn": array of strings (skills to close gaps toward the
      matched opportunities)
    - "suggested_timeframe": string (e.g. "2-4 weeks"), optional
- "recommended_next_steps": array of strings, concrete immediate actions.

Ground every milestone in the student's actual skill gaps relative to the
listed opportunities -- do not invent skills that aren't relevant to the
opportunities or the student's stated career goal. Keep it concise:
3-5 milestones, 3-6 next steps.
"""


def validate_roadmap(data) -> dict:
    """Validates a parsed roadmap response against ROADMAP_SCHEMA. Raises
    PromptValidationError on any contract violation."""
    if not isinstance(data, dict):
        raise PromptValidationError("Roadmap output must be a JSON object")

    for field in ROADMAP_SCHEMA["required"]:
        if field not in data:
            raise PromptValidationError(f"Missing required field: {field}")

    allowed_keys = set(ROADMAP_SCHEMA["properties"].keys())
    unknown = set(data.keys()) - allowed_keys
    if unknown:
        raise PromptValidationError(f"Unexpected field(s): {sorted(unknown)}")

    if not isinstance(data.get("summary"), str) or not data["summary"].strip():
        raise PromptValidationError("'summary' must be a non-empty string")

    milestones = data.get("milestones")
    if not isinstance(milestones, list) or len(milestones) == 0:
        raise PromptValidationError("'milestones' must be a non-empty list")

    for i, m in enumerate(milestones):
        if not isinstance(m, dict):
            raise PromptValidationError(f"milestones[{i}] must be an object")
        for field in ("title", "description", "skills_to_learn"):
            if field not in m:
                raise PromptValidationError(
                    f"milestones[{i}] missing required field: {field}"
                )
        if not isinstance(m["title"], str) or not m["title"].strip():
            raise PromptValidationError(f"milestones[{i}].title must be a non-empty string")
        if not isinstance(m["description"], str) or not m["description"].strip():
            raise PromptValidationError(
                f"milestones[{i}].description must be a non-empty string"
            )
        if not isinstance(m["skills_to_learn"], list) or not all(
            isinstance(s, str) for s in m["skills_to_learn"]
        ):
            raise PromptValidationError(
                f"milestones[{i}].skills_to_learn must be a list of strings"
            )
        timeframe = m.get("suggested_timeframe")
        if timeframe is not None and not isinstance(timeframe, str):
            raise PromptValidationError(
                f"milestones[{i}].suggested_timeframe must be a string or absent"
            )

    next_steps = data.get("recommended_next_steps")
    if not isinstance(next_steps, list) or not all(
        isinstance(s, str) for s in next_steps
    ):
        raise PromptValidationError(
            "'recommended_next_steps' must be a list of strings"
        )

    return data


# ---------------------------------------------------------------------------
# JSON parsing helper shared by both AI calls
# ---------------------------------------------------------------------------

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def parse_ai_json(raw: str) -> dict:
    """Parses a raw AI response string into a dict. Tolerates models that
    wrap JSON in markdown fences despite instructions not to. Raises
    PromptValidationError on anything that isn't parseable JSON."""
    if not isinstance(raw, str):
        raise PromptValidationError("AI response must be a string")

    cleaned = _FENCE_RE.sub("", raw).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise PromptValidationError(f"AI response is not valid JSON: {e}") from e


# ---------------------------------------------------------------------------
# High-level entry points (validate-on-arrival)
# ---------------------------------------------------------------------------


def extract_opportunity(raw_ai_response: str) -> dict:
    """Parses + validates a raw extraction response. Raises
    PromptValidationError if it doesn't meet the contract."""
    return validate_extraction(parse_ai_json(raw_ai_response))


def generate_roadmap(raw_ai_response: str) -> dict:
    """Parses + validates a raw roadmap response. Raises
    PromptValidationError if it doesn't meet the contract."""
    result = validate_roadmap(parse_ai_json(raw_ai_response))
    result["source"] = "ai"
    return result


# ---------------------------------------------------------------------------
# Fallback roadmap -- rules-based, no AI call. Built and tested before the
# AI version so the feature degrades gracefully when the model call fails,
# returns malformed JSON, or AI is switched off entirely.
# ---------------------------------------------------------------------------


def fallback_roadmap(profile: dict, recommendations: list) -> dict:
    """
    Builds a roadmap with NO AI call, from:
      - the student's level
      - the skills missing relative to their top recommendations
      - the top recommendations themselves

    `recommendations` is a list of either:
      - {"opportunity": {...}, "score": int, "reasons": [...]}, or
      - raw opportunity dicts

    Always returns a dict matching the same shape as generate_roadmap(),
    with "source": "fallback" so callers can tell which path produced it.
    """
    level = profile.get("level") or "Beginner"
    student_skills = set(profile.get("current_skills") or [])
    top_recs = list(recommendations)[:3]

    def opp_of(rec):
        return rec.get("opportunity", rec) if isinstance(rec, dict) else rec

    missing_skills = []
    for rec in top_recs:
        opp = opp_of(rec)
        for skill in opp.get("required_skills") or []:
            if skill not in student_skills and skill not in missing_skills:
                missing_skills.append(skill)

    milestones = [
        {
            "title": f"Strengthen your {level.lower()} foundations",
            "description": (
                "Review core concepts and close the most common skill gaps "
                "before applying to your top-matched opportunities."
            ),
            "skills_to_learn": missing_skills[:3],
            "suggested_timeframe": "2-4 weeks",
        }
    ]

    for rec in top_recs:
        opp = opp_of(rec)
        title = opp.get("title") or "the opportunity"
        category = opp.get("category") or "opportunity"
        opp_missing = [
            s for s in (opp.get("required_skills") or []) if s not in student_skills
        ][:3]
        milestones.append(
            {
                "title": f"Prepare for {title}",
                "description": (
                    f"Close remaining skill gaps and apply to this "
                    f"{category} opportunity once ready."
                ),
                "skills_to_learn": opp_missing,
                "suggested_timeframe": "Ongoing",
            }
        )

    next_steps = [f"Learn {skill}" for skill in missing_skills[:5]]
    if not next_steps:
        next_steps = ["Keep applying to your top-matched opportunities"]

    return {
        "summary": (
            f"A rules-based roadmap for a {level} student, focused on closing "
            f"{len(missing_skills)} skill gap(s) and preparing for your top "
            f"{len(top_recs)} matched opportunit"
            + ("y" if len(top_recs) == 1 else "ies")
            + "."
        ),
        "milestones": milestones,
        "recommended_next_steps": next_steps,
        "source": "fallback",
    }