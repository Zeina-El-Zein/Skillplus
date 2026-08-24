import json

import pytest

from prompts import (
    CATEGORIES,
    DIFFICULTY_LEVELS,
    CANONICAL_MAJORS,
    ALLOWED_MAJOR_VALUES,
    TASK_PRIORITIES,
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
        "steps": [
            {"title": "Learn Python basics", "description": "Complete an intro Python course.",
             "order": 1, "relevant_skill": "Python", "opportunity_category": "Bootcamp",
             "priority": "high"},
        ],
    },
    {
        "summary": "Build data manipulation skills to match top data science opportunities.",
        "steps": [
            {"title": "Learn Pandas", "description": "Practice data wrangling.",
             "order": 1, "relevant_skill": "Pandas", "opportunity_category": "Workshop",
             "priority": "high"},
            {"title": "Study ML basics", "description": "Cover core ML concepts.",
             "order": 2, "relevant_skill": "Machine Learning", "opportunity_category": "Bootcamp",
             "priority": "medium"},
        ],
    },
    {
        "summary": "You're well-positioned; focus on publishing and networking.",
        "steps": [
            {"title": "Draft a research note", "description": "Write up preliminary findings.",
             "order": 1, "relevant_skill": "Technical Writing", "opportunity_category": "Research",
             "priority": "medium"},
        ],
    },
    {
        "summary": "No strong matches yet -- broaden your search and build foundational skills.",
        "steps": [
            {"title": "Explore beginner-friendly opportunities", "description": "Cast a wider net.",
             "order": 1, "relevant_skill": "Figma", "opportunity_category": "Workshop",
             "priority": "low"},
        ],
    },
    {
        "summary": "Lean into your interest in education with hands-on mentorship.",
        "steps": [
            {"title": "Start tutoring", "description": "Apply to a peer tutoring program.",
             "order": 1, "relevant_skill": "Communication", "opportunity_category": "Mentorship",
             "priority": "medium"},
        ],
    },
]


@pytest.mark.parametrize("output", ROADMAP_MODEL_OUTPUTS)
def test_roadmap_validation_accepts_well_formed_output(output):
    raw = json.dumps(output)
    validated = generate_roadmap(raw)
    assert validated["source"] == "ai"
    assert validated["steps"]
    for step in validated["steps"]:
        assert step["opportunity_category"] in CATEGORIES
        assert step["priority"] in TASK_PRIORITIES
        # task_id is never set by the model -- must default to None
        assert step["task_id"] is None


def test_roadmap_validation_sorts_steps_by_order():
    # steps arrive out of order -- generate_roadmap must sort them
    out_of_order = {
        "summary": "x",
        "steps": [
            {"title": "Second", "description": "d", "order": 2, "relevant_skill": "SQL",
             "opportunity_category": "Workshop", "priority": "medium"},
            {"title": "First", "description": "d", "order": 1, "relevant_skill": "Python",
             "opportunity_category": "Workshop", "priority": "high"},
        ],
    }
    validated = generate_roadmap(json.dumps(out_of_order))
    assert [s["title"] for s in validated["steps"]] == ["First", "Second"]


# ---------------------------------------------------------------------------
# Roadmap validation -- rejection cases
# ---------------------------------------------------------------------------

def test_roadmap_rejects_empty_steps():
    bad = dict(ROADMAP_MODEL_OUTPUTS[0])
    bad["steps"] = []
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_missing_summary():
    bad = dict(ROADMAP_MODEL_OUTPUTS[0])
    del bad["summary"]
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_step_missing_title():
    bad = json.loads(json.dumps(ROADMAP_MODEL_OUTPUTS[0]))
    del bad["steps"][0]["title"]
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_bad_opportunity_category_enum():
    bad = json.loads(json.dumps(ROADMAP_MODEL_OUTPUTS[0]))
    bad["steps"][0]["opportunity_category"] = "Freelance"  # not one of the 8
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_bad_priority_enum():
    bad = json.loads(json.dumps(ROADMAP_MODEL_OUTPUTS[0]))
    bad["steps"][0]["priority"] = "urgent"  # not high/medium/low
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_non_integer_order():
    bad = json.loads(json.dumps(ROADMAP_MODEL_OUTPUTS[0]))
    bad["steps"][0]["order"] = "first"
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_duplicate_order_values():
    bad = {
        "summary": "x",
        "steps": [
            {"title": "A", "description": "d", "order": 1, "relevant_skill": "Python",
             "opportunity_category": "Workshop", "priority": "high"},
            {"title": "B", "description": "d", "order": 1, "relevant_skill": "SQL",
             "opportunity_category": "Workshop", "priority": "low"},
        ],
    }
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_hallucinated_opportunity_field():
    # Gemini must never name a specific opportunity -- any extra field on
    # a step (e.g. an invented opportunity name/link) is rejected outright
    # since the step schema has additionalProperties: False.
    bad = json.loads(json.dumps(ROADMAP_MODEL_OUTPUTS[0]))
    bad["steps"][0]["opportunity_name"] = "Google STEP Internship"
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_rejects_model_set_task_id():
    # task_id can only be assigned by the backend once a step is linked
    # to a real student_tasks record -- the model can never set one.
    bad = json.loads(json.dumps(ROADMAP_MODEL_OUTPUTS[0]))
    bad["steps"][0]["task_id"] = 42
    with pytest.raises(PromptValidationError):
        validate_roadmap(bad)


def test_roadmap_allows_null_task_id_from_model():
    # A model explicitly emitting task_id: null is fine -- it's only a
    # non-null value that's rejected.
    ok = json.loads(json.dumps(ROADMAP_MODEL_OUTPUTS[0]))
    ok["steps"][0]["task_id"] = None
    validated = validate_roadmap(ok)
    assert validated["steps"][0]["task_id"] is None


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
    assert validated["steps"]
    for step in validated["steps"]:
        assert step["opportunity_category"] in CATEGORIES
        assert step["priority"] in TASK_PRIORITIES
        assert step["task_id"] is None


def test_fallback_roadmap_targets_missing_skills_only():
    profile = {"level": "Intermediate", "current_skills": ["Python"]}
    recommendations = [
        {"opportunity": {"title": "Data Role", "category": "Internship",
                          "required_skills": ["Python", "SQL", "Pandas"]}, "score": 80}
    ]
    result = fallback_roadmap(profile, recommendations)
    foundation_skill = result["steps"][0]["relevant_skill"]
    # First missing skill (not already known) should anchor the
    # foundations step -- Python is already known so shouldn't be it.
    assert foundation_skill != "Python"
    assert foundation_skill in ("SQL", "Pandas")


def test_fallback_roadmap_steps_are_sequentially_ordered():
    profile = {"level": "Beginner", "current_skills": []}
    recommendations = [
        {"opportunity": {"title": "A", "category": "Workshop", "required_skills": ["Git"]}, "score": 80},
        {"opportunity": {"title": "B", "category": "Internship", "required_skills": ["SQL"]}, "score": 60},
    ]
    result = fallback_roadmap(profile, recommendations)
    orders = [s["order"] for s in result["steps"]]
    assert orders == list(range(1, len(orders) + 1))


def test_fallback_roadmap_priority_ranked_by_recommendation_order():
    profile = {"level": "Beginner", "current_skills": []}
    recommendations = [
        {"opportunity": {"title": "Top", "category": "Internship", "required_skills": []}, "score": 90},
        {"opportunity": {"title": "Second", "category": "Workshop", "required_skills": []}, "score": 70},
        {"opportunity": {"title": "Third", "category": "Research", "required_skills": []}, "score": 50},
    ]
    result = fallback_roadmap(profile, recommendations)
    # steps[0] is the foundations step; steps[1:] map to the recommendations
    rec_steps = result["steps"][1:]
    assert rec_steps[0]["priority"] == "high"
    assert rec_steps[1]["priority"] == "medium"
    assert rec_steps[2]["priority"] == "low"


def test_fallback_roadmap_handles_no_recommendations():
    result = fallback_roadmap({"level": "Beginner", "current_skills": []}, [])
    assert result["source"] == "fallback"
    assert len(result["steps"]) == 1  # just the foundations step
    assert result["steps"][0]["order"] == 1


def test_fallback_roadmap_accepts_raw_opportunity_dicts_not_just_wrapped():
    profile = {"level": "Beginner", "current_skills": []}
    recommendations = [{"title": "Raw Opp", "category": "Workshop", "required_skills": ["Git"]}]
    result = fallback_roadmap(profile, recommendations)
    relevant_skills = [s["relevant_skill"] for s in result["steps"]]
    assert "Git" in relevant_skills


def test_fallback_roadmap_opportunity_category_falls_back_when_invalid():
    # If an opportunity's category somehow isn't one of the 8 canonical
    # values, fallback_roadmap must not propagate an invalid enum value
    # into the roadmap step (it would fail validate_roadmap otherwise).
    profile = {"level": "Beginner", "current_skills": []}
    recommendations = [
        {"opportunity": {"title": "Weird", "category": "Freelance", "required_skills": []}, "score": 50}
    ]
    result = fallback_roadmap(profile, recommendations)
    assert result["steps"][1]["opportunity_category"] in CATEGORIES