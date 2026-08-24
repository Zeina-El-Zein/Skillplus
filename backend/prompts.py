"""
AI integration layer: prompt construction, output contracts, and validation
for the two AI-backed features:

  1. Extraction  — turn a pasted opportunity description into structured
     fields that match scoring.py's contract (see EXTRACTION_SCHEMA).
  2. Roadmap     — turn a student profile + their scored recommendations
     into a personalized, ordered step-by-step roadmap (see
     ROADMAP_SCHEMA). Steps are structured (not paragraph text) so the
     frontend can render them as a visual timeline.

Both prompts demand strict JSON and nothing else. Nothing here trusts the
model: every response is parsed and validated against the schema before
it's allowed to touch the rest of the app. If validation fails, or the AI
call fails/is disabled, `fallback_roadmap()` produces a roadmap with no AI
call at all (rules-based: level + missing skills + top recommendations).

ROADMAP STEPS AND OPPORTUNITIES: Gemini suggests a `relevant_skill` and
`opportunity_category` per step -- it never invents or names a specific
opportunity. Matching a step to real opportunity rows is done afterward
by the existing recommendation logic (scoring.py), querying the database
for opportunities whose category/skills line up with the step. This
keeps "real opportunities only" enforced structurally, not just by
prompt instruction.

ROADMAP STEPS AND STUDENT TASKS: a step has no `status` field of its own
-- per team agreement (see #36 dependencies), progress lives only on the
linked `student_tasks` record, using that system's shared status values
(todo / in_progress / done) and priority values (high / medium / low).
A step's `task_id` is null until the backend links it to a task; Gemini
never sets task_id, since it can't know a task's ID before one exists.

Note: this module owns the reasoning layer (prompts, schemas, validation,
fallback). Wiring the actual Gemini client is tracked separately (blocked
on the API key per this week's issue); `call_ai_fn` below is injected so
that piece can be swapped in without touching this file.

CANONICAL VALUES: DIFFICULTY_LEVELS, CATEGORIES, and CANONICAL_MAJORS below
are the single source of truth shared with the profile form dropdown and
backend/seed.sql. Do not add, remove, or rename values here without
telling the team -- these three lists must stay byte-identical across all
three places. TASK_STATUSES and TASK_PRIORITIES mirror the shared
student_tasks system (owned by Sara Noun) -- same rule applies.
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

# Shared student_tasks system values (owned by Sara Noun). Roadmap steps
# reuse these directly -- there is no separate roadmap status/priority
# system. TASK_STATUSES is not used for validation *within* this module
# (a roadmap step has no status field), but is kept here as the single
# documented reference for anything in this file that talks about task
# status (e.g. future roadmap<->task sync helpers).
TASK_STATUSES = ["todo", "in_progress", "done"]
TASK_PRIORITIES = ["high", "medium", "low"]


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
#
# Structured, step-based (not paragraph text) so the frontend can render a
# visual timeline: completed / current / upcoming steps in order. Each
# step names a skill + opportunity category for the recommendation logic
# to match against real DB rows -- Gemini never names a specific
# opportunity. Steps carry no status: progress is tracked entirely via the
# linked student_tasks record (task_id), once/if a step is turned into a
# task.
# ---------------------------------------------------------------------------

ROADMAP_SCHEMA = {
    "type": "object",
    "required": ["summary", "steps"],
    "properties": {
        "summary": {"type": "string"},
        "steps": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": [
                    "title",
                    "description",
                    "order",
                    "relevant_skill",
                    "opportunity_category",
                    "priority",
                ],
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "order": {"type": "integer"},
                    "relevant_skill": {"type": "string"},
                    "opportunity_category": {"type": "string", "enum": CATEGORIES},
                    "priority": {"type": "string", "enum": TASK_PRIORITIES},
                },
                "additionalProperties": False,
            },
        },
    },
    "additionalProperties": False,
}


def build_roadmap_prompt(profile: dict, recommendations: list) -> str:
    """Builds the prompt that generates a personalized, ordered roadmap
    from a student profile and their top scored recommendations. Output
    must be strict JSON matching ROADMAP_SCHEMA -- no markdown fences, no
    commentary.

    Each step names a relevant_skill + opportunity_category only -- the
    model is explicitly instructed not to name or invent a specific
    opportunity. Real opportunity matching happens afterward via
    scoring.py against the database."""
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

    return f"""You are a career/academic advisor. Build a personalized,
ordered roadmap for the student described below, using their profile and
their top matched opportunities.

Respond with STRICT JSON ONLY. No markdown code fences, no preamble, no
explanation, no trailing text -- the response must start with {{ and end
with }} and be directly parseable by json.loads().

Student profile:
{json.dumps(profile, default=str)}

Top matched opportunities (already scored by our system -- for context on
the student's current best-fit options, not a list to copy from):
{json.dumps(rec_summaries, default=str)}

Return an object with exactly these fields:
- "summary": string, 2-3 sentences summarizing the roadmap's focus.
- "steps": a JSON array of step objects, ordered from first to last, each
  with:
    - "title": string, short step name.
    - "description": string, what the student should do in this step and
      why it matters.
    - "order": integer, the step's sequential position starting at 1.
    - "relevant_skill": string, the single skill this step is meant to
      close a gap in. Must be a real, specific skill (e.g. "SQL", not
      "technical skills").
    - "opportunity_category": string, MUST be exactly one of:
      {CATEGORIES}. This is the category of opportunity this step should
      lead toward -- NOT the name of a specific opportunity.
    - "priority": string, MUST be exactly one of: {TASK_PRIORITIES}.

CRITICAL: Do NOT name, describe, or invent a specific opportunity, course,
company, or program anywhere in the roadmap. Only suggest a skill and an
opportunity_category per step. Matching each step to real opportunities is
handled separately, outside this response -- naming one here would be
guessing, and specific opportunities can change or expire.

Ground every step in the student's actual skill gaps relative to the
listed opportunities and their stated career goal -- do not invent skills
that aren't relevant. Keep it concise: 3-6 steps, ordered from foundational
to advanced.
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

    steps = data.get("steps")
    if not isinstance(steps, list) or len(steps) == 0:
        raise PromptValidationError("'steps' must be a non-empty list")

    step_required = (
        "title",
        "description",
        "order",
        "relevant_skill",
        "opportunity_category",
        "priority",
    )
    step_allowed_keys = set(step_required) | {"task_id"}

    seen_orders = []
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            raise PromptValidationError(f"steps[{i}] must be an object")

        for field in step_required:
            if field not in step:
                raise PromptValidationError(
                    f"steps[{i}] missing required field: {field}"
                )

        unknown_step_keys = set(step.keys()) - step_allowed_keys
        if unknown_step_keys:
            raise PromptValidationError(
                f"steps[{i}] has unexpected field(s): {sorted(unknown_step_keys)}"
            )

        if not isinstance(step["title"], str) or not step["title"].strip():
            raise PromptValidationError(f"steps[{i}].title must be a non-empty string")

        if not isinstance(step["description"], str) or not step["description"].strip():
            raise PromptValidationError(
                f"steps[{i}].description must be a non-empty string"
            )

        if not isinstance(step["order"], int) or isinstance(step["order"], bool):
            raise PromptValidationError(f"steps[{i}].order must be an integer")
        seen_orders.append(step["order"])

        if (
            not isinstance(step["relevant_skill"], str)
            or not step["relevant_skill"].strip()
        ):
            raise PromptValidationError(
                f"steps[{i}].relevant_skill must be a non-empty string"
            )

        if step["opportunity_category"] not in CATEGORIES:
            raise PromptValidationError(
                f"steps[{i}].opportunity_category must be one of {CATEGORIES}, "
                f"got {step['opportunity_category']!r}"
            )

        if step["priority"] not in TASK_PRIORITIES:
            raise PromptValidationError(
                f"steps[{i}].priority must be one of {TASK_PRIORITIES}, "
                f"got {step['priority']!r}"
            )

        # task_id is never set by the model -- it's added by the backend
        # once/if a step is linked to a student_tasks record. If somehow
        # present on inbound AI output, it must be null.
        if "task_id" in step and step["task_id"] is not None:
            raise PromptValidationError(
                f"steps[{i}].task_id must not be set by the model (found "
                f"{step['task_id']!r}) -- task linking happens after generation"
            )
        step.setdefault("task_id", None)

    if len(seen_orders) != len(set(seen_orders)):
        raise PromptValidationError("'steps' order values must be unique")

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


def _renumber_steps(steps: list) -> list:
    """Re-numbers an already-sorted step list's `order` field to a clean
    1..N sequence. validate_roadmap() only enforces that order values are
    unique, so a model could legally return gappy values like 1, 4, 9 --
    those pass validation but would render as gaps in a frontend timeline
    that shows "Step 1, Step 2, Step 3...". Renumbering here, shared by
    both the AI and fallback paths, guarantees every roadmap the rest of
    the app sees has a contiguous order starting at 1."""
    for i, step in enumerate(steps, start=1):
        step["order"] = i
    return steps


def generate_roadmap(raw_ai_response: str) -> dict:
    """Parses + validates a raw roadmap response. Raises
    PromptValidationError if it doesn't meet the contract."""
    result = validate_roadmap(parse_ai_json(raw_ai_response))
    result["steps"] = _renumber_steps(
        sorted(result["steps"], key=lambda s: s["order"])
    )
    result["source"] = "ai"
    return result


# ---------------------------------------------------------------------------
# Fallback roadmap -- rules-based, no AI call. Built and tested before the
# AI version so the feature degrades gracefully when the model call fails,
# returns malformed JSON, or AI is switched off entirely. Returns the same
# step-based shape as generate_roadmap() so the frontend timeline never
# needs to know which path produced the data.
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

    Always returns a dict matching the same shape as generate_roadmap()
    (summary + ordered steps), with "source": "fallback" so callers can
    tell which path produced it. Every step's task_id is None -- linking
    to a student_tasks record happens later, same as the AI path.
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

    order = 1
    steps = [
        {
            "title": f"Strengthen your {level.lower()} foundations",
            "description": (
                "Review core concepts and close the most common skill gaps "
                "before applying to your top-matched opportunities."
            ),
            "order": order,
            "relevant_skill": missing_skills[0] if missing_skills else "Fundamentals",
            "opportunity_category": "Workshop",
            "priority": "high",
            "task_id": None,
        }
    ]

    for i, rec in enumerate(top_recs):
        order += 1
        opp = opp_of(rec)
        title = opp.get("title") or "the opportunity"
        category = opp.get("category")
        opp_missing = [
            s for s in (opp.get("required_skills") or []) if s not in student_skills
        ]
        steps.append(
            {
                "title": f"Prepare for {title}",
                "description": (
                    f"Close remaining skill gaps and apply to this "
                    f"{category or 'matched'} opportunity once ready."
                ),
                "order": order,
                "relevant_skill": opp_missing[0] if opp_missing else "Application Prep",
                "opportunity_category": (
                    category if category in CATEGORIES else "Internship"
                ),
                "priority": "high" if i == 0 else ("medium" if i == 1 else "low"),
                "task_id": None,
            }
        )

    return {
        "summary": (
            f"A rules-based roadmap for a {level} student, focused on closing "
            f"{len(missing_skills)} skill gap(s) and preparing for your top "
            f"{len(top_recs)} matched opportunit"
            + ("y" if len(top_recs) == 1 else "ies")
            + "."
        ),
        "steps": _renumber_steps(steps),
        "source": "fallback",
    }