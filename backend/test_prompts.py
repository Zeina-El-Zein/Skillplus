import json

import pytest

from prompts import (
    CATEGORIES,
    DIFFICULTY_LEVELS,
    CANONICAL_MAJORS,
    ALLOWED_MAJOR_VALUES,
    PromptValidationError,
    build_extraction_prompt,
    build_roadmap_prompt,
    validate_extraction,
    validate_roadmap,
    parse_ai_json,
    extract_opportunity,
    generate_roadmap,
    fallback_roadmap,
)

# ===========================================================================
# 1. Extraction prompt -- 5 varied description inputs
# ===========================================================================

EXTRACTION_INPUTS = [
    # 1. Well-specified internship
    """Software Engineering Intern - Summer 2026
    We're looking for a CS student to join our backend team. Must know
    Python and SQL. This is a 10 hour/week remote internship, open to
    juniors and seniors. Great for students aiming to become software
    engineers. Apply by March 15, 2026.""",
    # 2. Open-to-all-majors hackathon, minimal detail
    """48-hour campus hackathon, all majors welcome, all skill levels.
    Bring a laptop and a team of up to 4. No prior experience needed.""",
    # 3. Advanced research position, no explicit deadline
    """Advanced Machine Learning Research Assistant needed in the
    Electrical Engineering department. Requires strong Python, PyTorch,
    and prior research experience. Roughly 15 hours per week. Ideal for
    PhD-track students interested in becoming ML researchers or data
    scientists.""",
    # 4. Civil engineering mentorship with vague year requirement
    """Structural Design Mentorship for underclassmen (1st and 2nd
    years) in Civil Engineering. Learn AutoCAD and site inspection
    basics. 5 hours/week, beginner-friendly.""",
    # 5. Chemical engineering project, no skills or hours mentioned
    """Chemical process optimization project, open to any major, any
    year. Great if you're exploring a career in process engineering.""",
]


@pytest.mark.parametrize("description", EXTRACTION_INPUTS)
def test_extraction_prompt_contains_contract_and_input(description):
    prompt = build_extraction_prompt(description)
    # The description itself must be embedded
    assert description.strip() in prompt
    # The prompt must spell out the exact allowed enums (strict contract)
    for category in CATEGORIES:
        assert category in prompt
    for level in DIFFICULTY_LEVELS:
        assert level in prompt
    for major in CANONICAL_MAJORS:
        assert major in prompt
    assert "Any" in prompt
    # Must demand strict JSON only
    assert "STRICT JSON ONLY" in prompt
    assert "json.loads()" in prompt


# Simulated model outputs for the 5 inputs above (stands in for live Gemini
# calls, which are blocked on the API key per this week's issue). These
# exercise the full parse -> validate pipeline exactly as real responses
# would.
EXTRACTION_MODEL_OUTPUTS = [
    {
        "title": "Software Engineering Intern - Summer 2026",
        "category": "Internship",
        "difficulty": "Intermediate",
        "suitable_major": "Computer Science",
        "suitable_year": 3,
        "required_skills": ["Python", "SQL"],
        "skills_gained": ["Backend Development", "Code Review"],
        "hours_per_week": 10,
        "estimated_time": "10 weeks",
        "cv_benefit": "Real-world backend engineering experience",
        "link": "https://example.com/swe-intern",
        "deadline": "2026-03-15",
    },
    {
        "title": "Campus Hackathon",
        "category": "Hackathon",
        "difficulty": "Beginner",
        "suitable_major": "Any",
        "suitable_year": None,
        "required_skills": [],
        "skills_gained": ["Teamwork", "Rapid Prototyping"],
        "hours_per_week": None,
        "estimated_time": "48 hours",
        "cv_benefit": None,
        "link": None,
        "deadline": None,
    },
    {
        "title": "ML Research Assistant",
        "category": "Research",
        "difficulty": "Advanced",
        "suitable_major": "Electrical Engineering",
        "suitable_year": None,
        "required_skills": ["Python", "PyTorch"],
        "skills_gained": ["Research Methods", "Model Evaluation"],
        "hours_per_week": 15,
        "estimated_time": "One semester",
        "cv_benefit": "Publishable research experience",
        "link": None,
        "deadline": None,
    },
    {
        "title": "Structural Design Mentorship",
        "category": "Mentorship",
        "difficulty": "Beginner",
        "suitable_major": "Civil Engineering",
        "suitable_year": 1,
        "required_skills": ["AutoCAD"],
        "skills_gained": ["Site Inspection", "Structural Design"],
        "hours_per_week": 5,
        "estimated_time": None,
        "cv_benefit": None,
        "link": None,
        "deadline": None,
    },
    {
        # LeetCode-style self-paced row: NULL deadline, NULL hours_per_week
        "title": "LeetCode Practice",
        "category": "Workshop",
        "difficulty": "Intermediate",
        "suitable_major": "Any",
        "suitable_year": None,
        "required_skills": ["Python", "Algorithms"],
        "skills_gained": ["Problem Solving", "Algorithms"],
        "hours_per_week": None,
        "estimated_time": "Self-paced",
        "cv_benefit": "Demonstrates strong algorithmic problem-solving",
        "link": "https://leetcode.com",
        "deadline": None,
    },
]


@pytest.mark.parametrize("output", EXTRACTION_MODEL_OUTPUTS)
def test_extraction_validation_accepts_well_formed_output(output):
    raw = json.dumps(output)
    validated = extract_opportunity(raw)
    assert validated["category"] in CATEGORIES
    assert validated["difficulty"] in DIFFICULTY_LEVELS
    assert validated["suitable_major"] in ALLOWED_MAJOR_VALUES


def test_extraction_tolerates_markdown_fences():
    output = EXTRACTION_MODEL_OUTPUTS[0]
    raw = "```json\n" + json.dumps(output) + "\n```"
    validated = extract_opportunity(raw)
    assert validated["title"] == output["title"]


# ---------------------------------------------------------------------------
# parse_ai_json -- tested directly, not just through extract_opportunity/
# generate_roadmap, since fence-stripping is its own piece of logic.
# ---------------------------------------------------------------------------

def test_parse_ai_json_parses_plain_json():
    result = parse_ai_json('{"a": 1, "b": [2, 3]}')
    assert result == {"a": 1, "b": [2, 3]}


def test_parse_ai_json_strips_markdown_fences():
    result = parse_ai_json('```json\n{"a": 1}\n```')
    assert result == {"a": 1}


def test_parse_ai_json_strips_fences_without_json_tag():
    result = parse_ai_json('```\n{"a": 1}\n```')
    assert result == {"a": 1}


def test_parse_ai_json_rejects_non_json_string():
    with pytest.raises(PromptValidationError):
        parse_ai_json("this is not json")


def test_parse_ai_json_rejects_non_string_input():
    with pytest.raises(PromptValidationError):
        parse_ai_json({"already": "a dict"})


# ---------------------------------------------------------------------------
# Extraction validation -- rejection cases (malformed / out-of-contract)
# ---------------------------------------------------------------------------

def test_extraction_rejects_invalid_json():
    with pytest.raises(PromptValidationError):
        extract_opportunity("not json at all")


def test_extraction_rejects_bad_difficulty_enum():
    bad = dict(EXTRACTION_MODEL_OUTPUTS[0])
    bad["difficulty"] = "Expert"  # not one of the 3 allowed values
    with pytest.raises(PromptValidationError):
        validate_extraction(bad)


def test_extraction_rejects_bad_category_enum():
    bad = dict(EXTRACTION_MODEL_OUTPUTS[0])
    bad["category"] = "Job"  # not one of the 8 allowed categories
    with pytest.raises(PromptValidationError):
        validate_extraction(bad)


def test_extraction_rejects_bad_major_not_in_canonical_list_or_any():
    bad = dict(EXTRACTION_MODEL_OUTPUTS[0])
    bad["suitable_major"] = "Philosophy"  # not canonical, not "Any"
    with pytest.raises(PromptValidationError):
        validate_extraction(bad)


def test_extraction_rejects_missing_required_field():
    bad = dict(EXTRACTION_MODEL_OUTPUTS[0])
    del bad["category"]
    with pytest.raises(PromptValidationError):
        validate_extraction(bad)


def test_extraction_rejects_unexpected_field():
    bad = dict(EXTRACTION_MODEL_OUTPUTS[0])
    bad["extra_hallucinated_field"] = "surprise"
    with pytest.raises(PromptValidationError):
        validate_extraction(bad)


def test_extraction_rejects_wrong_type_for_skills():
    bad = dict(EXTRACTION_MODEL_OUTPUTS[0])
    bad["required_skills"] = "Python, SQL"  # should be a list, not a string
    with pytest.raises(PromptValidationError):
        validate_extraction(bad)


# ===========================================================================
# 2. Roadmap prompt -- 5 varied (profile, recommendations) inputs
# ===========================================================================

ROADMAP_INPUTS = [
    (
        {"level": "Beginner", "current_skills": [], "career_goal": "Software Engineer"},
        [{"opportunity": {"title": "Intro Coding Bootcamp", "category": "Workshop",
                           "difficulty": "Beginner", "required_skills": ["Python"]}, "score": 60}],
    ),
    (
        {"level": "Intermediate", "current_skills": ["Python", "SQL"], "career_goal": "Data Scientist"},
        [{"opportunity": {"title": "Data Science Internship", "category": "Internship",
                           "difficulty": "Intermediate", "required_skills": ["Python", "Pandas", "SQL"]}, "score": 85},
         {"opportunity": {"title": "Kaggle Competition Team", "category": "Competition",
                           "difficulty": "Intermediate", "required_skills": ["Python", "ML"]}, "score": 70}],
    ),
    (
        {"level": "Advanced", "current_skills": ["Python", "PyTorch", "Research"], "career_goal": "ML Researcher"},
        [{"opportunity": {"title": "ML Research Assistant", "category": "Research",
                           "difficulty": "Advanced", "required_skills": ["Python", "PyTorch"]}, "score": 95}],
    ),
    (
        {"level": "Beginner", "current_skills": ["Figma"], "career_goal": None},
        [],  # no recommendations at all
    ),
    (
        {"level": "Intermediate", "current_skills": ["Excel"], "career_goal": "Educator"},
        [{"opportunity": {"title": "Peer Tutoring Mentorship", "category": "Mentorship",
                           "difficulty": "Beginner", "required_skills": []}, "score": 40}],
    ),
]


@pytest.mark.parametrize("profile,recommendations", ROADMAP_INPUTS)
def test_roadmap_prompt_contains_profile_and_recommendations(profile, recommendations):
    prompt = build_roadmap_prompt(profile, recommendations)
    assert "STRICT JSON ONLY" in prompt
    assert "json.loads()" in prompt
    if profile.get("level"):
        assert profile["level"] in prompt
    for rec in recommendations:
        assert rec["opportunity"]["title"] in prompt


ROADMAP_MODEL_OUTPUTS = [
    {
        "summary": "Focus on Python fundamentals before applying to coding-heavy roles.",
        "milestones": [
            {"title": "Learn Python basics", "description": "Complete an intro Python course.",
             "skills_to_learn": ["Python"], "suggested_timeframe": "3 weeks"},
        ],
        "recommended_next_steps": ["Enroll in an intro Python course"],
    },
    {
        "summary": "Build data manipulation skills to match top data science opportunities.",
        "milestones": [
            {"title": "Learn Pandas", "description": "Practice data wrangling.",
             "skills_to_learn": ["Pandas"], "suggested_timeframe": "2 weeks"},
            {"title": "Study ML basics", "description": "Cover core ML concepts.",
             "skills_to_learn": ["ML"], "suggested_timeframe": "4 weeks"},
        ],
        "recommended_next_steps": ["Apply to the Data Science Internship", "Join the Kaggle team"],
    },
    {
        "summary": "You're well-positioned; focus on publishing and networking.",
        "milestones": [
            {"title": "Draft a research note", "description": "Write up preliminary findings.",
             "skills_to_learn": []},
        ],
        "recommended_next_steps": ["Apply to the ML Research Assistant role"],
    },
    {
        "summary": "No strong matches yet -- broaden your search and build foundational skills.",
        "milestones": [
            {"title": "Explore beginner-friendly opportunities", "description": "Cast a wider net.",
             "skills_to_learn": ["Figma"]},
        ],
        "recommended_next_steps": ["Search for more beginner-friendly opportunities"],
    },
    {
        "summary": "Lean into your interest in education with hands-on volunteering.",
        "milestones": [
            {"title": "Start tutoring", "description": "Apply to the after-school program.",
             "skills_to_learn": []},
        ],
        "recommended_next_steps": ["Apply to the Peer Tutoring Mentorship program"],
    },
]


@pytest.mark.parametrize("output", ROADMAP_MODEL_OUTPUTS)
def test_roadmap_validation_accepts_well_formed_output(output):
    raw = json.dumps(output)
    validated = generate_roadmap(raw)
    assert validated["source"] == "ai"
    assert validated["milestones"]


# ---------------------------------------------------------------------------
# Roadmap validation -- rejection cases
# ---------------------------------------------------------------------------

def test_roadmap_rejects_empty_milestones():
    bad = dict(ROADMAP_MODEL_OUTPUTS[0])
    bad["milestones"] = []
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_missing_summary():
    bad = dict(ROADMAP_MODEL_OUTPUTS[0])
    del bad["summary"]
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_milestone_missing_title():
    bad = json.loads(json.dumps(ROADMAP_MODEL_OUTPUTS[0]))
    del bad["milestones"][0]["title"]
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_non_list_next_steps():
    bad = dict(ROADMAP_MODEL_OUTPUTS[0])
    bad["recommended_next_steps"] = "just apply somewhere"
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_invalid_json():
    with pytest.raises(PromptValidationError):
        generate_roadmap("{not valid json")


# ===========================================================================
# 3. fallback_roadmap -- rules-based, AI switched off entirely
# ===========================================================================

@pytest.mark.parametrize("profile,recommendations", ROADMAP_INPUTS)
def test_fallback_roadmap_never_calls_ai_and_matches_schema_shape(profile, recommendations):
    result = fallback_roadmap(profile, recommendations)
    assert result["source"] == "fallback"
    # Must satisfy the same contract as the AI path so callers can treat
    # them interchangeably.
    validated = validate_roadmap({k: v for k, v in result.items() if k != "source"})
    assert validated["milestones"]
    assert isinstance(validated["recommended_next_steps"], list)


def test_fallback_roadmap_targets_missing_skills_only():
    profile = {"level": "Intermediate", "current_skills": ["Python"]}
    recommendations = [
        {"opportunity": {"title": "Data Role", "category": "Internship",
                          "required_skills": ["Python", "SQL", "Pandas"]}, "score": 80}
    ]
    result = fallback_roadmap(profile, recommendations)
    foundation_skills = result["milestones"][0]["skills_to_learn"]
    assert "Python" not in foundation_skills  # already known
    assert "SQL" in foundation_skills
    assert "Pandas" in foundation_skills


def test_fallback_roadmap_handles_no_recommendations():
    result = fallback_roadmap({"level": "Beginner", "current_skills": []}, [])
    assert result["source"] == "fallback"
    assert len(result["milestones"]) == 1  # just the foundations milestone
    assert result["recommended_next_steps"] == [
        "Keep applying to your top-matched opportunities"
    ]


def test_fallback_roadmap_accepts_raw_opportunity_dicts_not_just_wrapped():
    profile = {"level": "Beginner", "current_skills": []}
    recommendations = [{"title": "Raw Opp", "category": "Workshop", "required_skills": ["Git"]}]
    result = fallback_roadmap(profile, recommendations)
    assert any("Git" in m["skills_to_learn"] for m in result["milestones"])