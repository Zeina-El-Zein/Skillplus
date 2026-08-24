from datetime import date, timedelta

from scoring import (
    score_opportunity,
    filter_active_opportunities,
    match_opportunities_for_step,
    attach_opportunities_to_roadmap,
    WEIGHTS,
)


def make_perfect_pair():
    """A profile/opportunity pair that should hit every scoring factor."""
    profile = {
        "major": "Computer Science",
        "level": "Intermediate",
        "current_skills": ["Python", "SQL", "Git", "React"],
        "interests": ["Robotics"],
        "preferred_opportunity_type": "Internship",
        "year_of_study": 3,
        "available_time_per_week": 15,
        "career_goal": "Robotics Engineer",
    }
    opportunity = {
        "title": "Robotics Software Internship",
        "category": "Internship",
        "suitable_major": "Computer Science",
        "difficulty": "Intermediate",
        "required_skills": ["Python", "SQL", "Git", "React"],
        "skills_gained": ["Robotics", "Embedded Systems"],
        "suitable_year": 3,
        "hours_per_week": 10,
        "cv_benefit": "Great for robotics engineer career track",
        "deadline": None,
    }
    return profile, opportunity


def test_perfect_match_hits_100():
    profile, opportunity = make_perfect_pair()
    score, reasons = score_opportunity(profile, opportunity)
    assert score == 100
    assert len(reasons) > 0


def test_weights_sum_to_100_on_full_match():
    assert sum(WEIGHTS.values()) == 100


def test_no_match_scores_zero():
    profile = {
        "major": "Biology",
        "level": "Beginner",
        "current_skills": ["Excel"],
        "interests": ["Wildlife"],
        "preferred_opportunity_type": "Research",
        "year_of_study": 1,
        "available_time_per_week": 5,
        "career_goal": "Biologist",
    }
    opportunity = {
        "title": "Compiler Design Hackathon",
        "category": "Hackathon",
        "suitable_major": "Computer Science",
        "difficulty": "Advanced",
        "required_skills": ["Rust"],
        "skills_gained": ["Systems Programming"],
        "suitable_year": 4,
        "hours_per_week": 25,
        "cv_benefit": "Great for compiler engineer roles",
        "deadline": None,
    }
    score, reasons = score_opportunity(profile, opportunity)
    assert score == 0
    assert reasons == []


def test_missing_fields_do_not_crash():
    score, reasons = score_opportunity({}, {})
    assert score == 0
    assert reasons == []


# -----------------------------
# Major
# -----------------------------
def test_major_exact_match():
    score, reasons = score_opportunity(
        {"major": "Physics"}, {"suitable_major": "Physics"}
    )
    assert score == WEIGHTS["major"]
    assert "Matches your major" in reasons


def test_major_any_gives_half_credit():
    score, reasons = score_opportunity(
        {"major": "Physics"}, {"suitable_major": "Any"}
    )
    assert score == WEIGHTS["major"] // 2
    assert "Open to all majors" in reasons


def test_major_mismatch_gives_nothing():
    score, reasons = score_opportunity(
        {"major": "Physics"}, {"suitable_major": "Biology"}
    )
    assert score == 0


# -----------------------------
# Difficulty
# -----------------------------
def test_difficulty_exact_match():
    score, reasons = score_opportunity(
        {"level": "Beginner"}, {"difficulty": "Beginner"}
    )
    assert score == WEIGHTS["difficulty"]


def test_difficulty_one_level_off_gives_partial_credit():
    score, reasons = score_opportunity(
        {"level": "Beginner"}, {"difficulty": "Intermediate"}
    )
    assert score == 7
    assert "Close to your experience level" in reasons


def test_difficulty_two_levels_off_gives_nothing():
    score, reasons = score_opportunity(
        {"level": "Beginner"}, {"difficulty": "Advanced"}
    )
    assert score == 0


# -----------------------------
# Skills
# -----------------------------
def test_skills_award_five_points_each_capped_at_four():
    profile = {"current_skills": ["A", "B", "C", "D", "E", "F"]}
    opportunity = {"required_skills": ["A", "B", "C", "D", "E", "F"]}
    score, reasons = score_opportunity(profile, opportunity)
    assert score == 5 * 4  # capped at 4 matching skills
    assert len(reasons) == 4


def test_partial_skill_overlap():
    profile = {"current_skills": ["Python", "SQL"]}
    opportunity = {"required_skills": ["Python", "Rust"]}
    score, reasons = score_opportunity(profile, opportunity)
    assert score == 5
    assert "Uses your python skill" in reasons


# -----------------------------
# Interests (token-overlap against title/category/skills_gained)
# -----------------------------
def test_interest_matches_via_token_overlap():
    profile = {"interests": ["Robotics"]}
    opportunity = {"title": "Robotics Club", "category": "Workshop", "skills_gained": []}
    score, reasons = score_opportunity(profile, opportunity)
    assert score == WEIGHTS["interests"]
    assert "Matches one of your interests" in reasons


def test_interest_no_match_gives_nothing():
    profile = {"interests": ["Painting"]}
    opportunity = {"title": "Robotics Club", "category": "Workshop", "skills_gained": []}
    score, reasons = score_opportunity(profile, opportunity)
    assert score == 0


# -----------------------------
# Preferred opportunity type
# -----------------------------
def test_preferred_type_match():
    profile = {"preferred_opportunity_type": "Internship"}
    opportunity = {"category": "Internship"}
    score, reasons = score_opportunity(profile, opportunity)
    assert score == WEIGHTS["opportunity_type"]


# -----------------------------
# Suitable year (single INTEGER column, not a list)
# -----------------------------
def test_suitable_year_exact_match():
    score, reasons = score_opportunity(
        {"year_of_study": 2}, {"suitable_year": 2}
    )
    assert score == WEIGHTS["suitable_year"]
    assert "Suitable for your year of study" in reasons


def test_suitable_year_one_off_gives_partial_credit():
    score, reasons = score_opportunity(
        {"year_of_study": 2}, {"suitable_year": 3}
    )
    assert score == 5
    assert "Close to your year of study" in reasons


def test_suitable_year_far_off_gives_nothing():
    score, reasons = score_opportunity(
        {"year_of_study": 1}, {"suitable_year": 4}
    )
    assert score == 0


def test_suitable_year_null_on_opportunity_gives_partial_credit():
    # e.g. a self-paced / open-to-all-years listing with no suitable_year set
    score, reasons = score_opportunity(
        {"year_of_study": 1}, {"suitable_year": None}
    )
    assert score == 5
    assert "Suitable year is not specified" in reasons


def test_suitable_year_unknown_student_gives_nothing():
    score, reasons = score_opportunity(
        {}, {"suitable_year": 2}
    )
    assert score == 0


# -----------------------------
# Time compatibility (handles self-paced / NULL hours_per_week)
# -----------------------------
def test_hours_within_budget_full_credit():
    score, reasons = score_opportunity(
        {"available_time_per_week": 10}, {"hours_per_week": 8}
    )
    assert score == WEIGHTS["time"]
    assert "Fits your available time" in reasons


def test_hours_slightly_over_budget_partial_credit():
    score, reasons = score_opportunity(
        {"available_time_per_week": 10}, {"hours_per_week": 13}
    )
    assert score == 5
    assert "Slightly above your available time" in reasons


def test_hours_far_over_budget_no_credit():
    score, reasons = score_opportunity(
        {"available_time_per_week": 10}, {"hours_per_week": 20}
    )
    assert score == 0


def test_self_paced_null_hours_per_week_gives_partial_credit():
    # e.g. LeetCode-style row: self-paced, hours_per_week is NULL
    score, reasons = score_opportunity(
        {"available_time_per_week": 5}, {"hours_per_week": None}
    )
    assert score == 5
    assert "Weekly time commitment is not specified" in reasons


def test_null_deadline_treated_as_active():
    # LeetCode-style row: NULL deadline should never be filtered out
    today = date(2026, 8, 14)
    opportunities = [{"id": 1, "deadline": None}]
    active = filter_active_opportunities(opportunities, today=today)
    assert len(active) == 1


# -----------------------------
# Career goal (token overlap against title/category/skills_gained/cv_benefit)
# -----------------------------
def test_career_goal_matches_via_token_overlap():
    profile = {"career_goal": "Data Scientist"}
    opportunity = {
        "title": "Data Analytics Bootcamp",
        "category": "Workshop",
        "skills_gained": ["Data Science", "Statistics"],
        "cv_benefit": "",
    }
    score, reasons = score_opportunity(profile, opportunity)
    assert score == WEIGHTS["career_goal"]
    assert "Supports your career goal" in reasons


def test_career_goal_no_match_gives_nothing():
    profile = {"career_goal": "Data Scientist"}
    opportunity = {
        "title": "Painting Workshop",
        "category": "Workshop",
        "skills_gained": ["Watercolor"],
        "cv_benefit": "",
    }
    score, reasons = score_opportunity(profile, opportunity)
    assert score == 0


# -----------------------------
# filter_active_opportunities (unchanged, kept for regression safety)
# -----------------------------
def test_filter_active_opportunities_basic():
    today = date(2026, 1, 1)
    opportunities = [
        {"id": 1, "deadline": today - timedelta(days=1)},  # expired
        {"id": 2, "deadline": today},  # active (today counts)
        {"id": 3, "deadline": today + timedelta(days=1)},  # active
        {"id": 4, "deadline": None},  # active (self-paced)
    ]
    active = filter_active_opportunities(opportunities, today=today)
    active_ids = {o["id"] for o in active}
    assert active_ids == {2, 3, 4}


# -----------------------------
# match_opportunities_for_step / attach_opportunities_to_roadmap
#
# Roadmap steps (from prompts.py) only ever carry a relevant_skill and
# opportunity_category -- never a specific opportunity. These tests
# confirm real opportunities get matched to a step correctly, that the
# match narrows progressively rather than ever returning nothing, and
# that Gemini's suggestions are never trusted as real data (only used to
# filter/rank real DB rows).
# -----------------------------

def make_opportunity_pool():
    return [
        {
            "title": "Backend Development Internship",
            "category": "Internship",
            "suitable_major": "Computer Science",
            "difficulty": "Intermediate",
            "required_skills": ["Python", "SQL"],
            "skills_gained": ["FastAPI", "PostgreSQL"],
            "suitable_year": 2,
            "hours_per_week": 15,
            "deadline": None,
        },
        {
            "title": "Git and GitHub Fundamentals",
            "category": "Workshop",
            "suitable_major": "Any",
            "difficulty": "Beginner",
            "required_skills": [],
            "skills_gained": ["Git", "Version Control"],
            "suitable_year": 1,
            "hours_per_week": 2,
            "deadline": None,
        },
        {
            "title": "AI Research Assistantship",
            "category": "Research",
            "suitable_major": "Computer Science",
            "difficulty": "Advanced",
            "required_skills": ["Python", "Machine Learning"],
            "skills_gained": ["PyTorch"],
            "suitable_year": 3,
            "hours_per_week": 15,
            "deadline": None,
        },
    ]


def make_step(relevant_skill, opportunity_category):
    return {
        "title": "test step",
        "description": "test",
        "order": 1,
        "relevant_skill": relevant_skill,
        "opportunity_category": opportunity_category,
        "priority": "high",
        "task_id": None,
    }


def make_test_profile():
    return {
        "major": "Computer Science",
        "level": "Beginner",
        "current_skills": ["Python"],
        "interests": [],
        "preferred_opportunity_type": None,
        "year_of_study": 1,
        "available_time_per_week": 10,
        "career_goal": "Software Engineer",
    }


def test_match_opportunities_category_and_skill_both_match():
    opportunities = make_opportunity_pool()
    step = make_step("SQL", "Internship")
    profile = make_test_profile()
    results = match_opportunities_for_step(step, profile, opportunities)
    assert results[0]["opportunity"]["title"] == "Backend Development Internship"
    assert results[0]["match_level"] == 1


def test_match_opportunities_skill_match_is_case_insensitive():
    opportunities = make_opportunity_pool()
    step = make_step("sql", "internship")  # lowercase, category won't match exactly
    profile = make_test_profile()
    results = match_opportunities_for_step(step, profile, opportunities)
    # category comparison is exact (opportunity_category is enum-constrained
    # upstream so casing should already be correct in practice), but skill
    # matching alone should still surface the right opportunity via the
    # skill_only path.
    assert any(
        r["opportunity"]["title"] == "Backend Development Internship" for r in results
    )


def test_match_opportunities_falls_back_to_category_only():
    opportunities = make_opportunity_pool()
    # Skill doesn't exist anywhere, but category does
    step = make_step("Kubernetes", "Workshop")
    profile = make_test_profile()
    results = match_opportunities_for_step(step, profile, opportunities)
    assert results[0]["opportunity"]["title"] == "Git and GitHub Fundamentals"
    assert results[0]["match_level"] == 2


def test_match_opportunities_falls_back_to_skill_only():
    opportunities = make_opportunity_pool()
    # Category doesn't exist anywhere in the pool, but skill does
    step = make_step("Python", "Bootcamp")
    profile = make_test_profile()
    results = match_opportunities_for_step(step, profile, opportunities)
    titles = [r["opportunity"]["title"] for r in results]
    assert "Backend Development Internship" in titles or "AI Research Assistantship" in titles
    assert all(r["match_level"] == 3 for r in results)


def test_match_opportunities_never_returns_empty_when_pool_is_nonempty():
    # Nothing matches skill or category at all -- must still return the
    # top overall fits (match_level 4), never an empty list, so a step
    # is never left with nothing to show.
    opportunities = make_opportunity_pool()
    step = make_step("Rust", "Competition")
    profile = make_test_profile()
    results = match_opportunities_for_step(step, profile, opportunities)
    assert len(results) > 0
    assert all(r["match_level"] == 4 for r in results)


def test_match_opportunities_empty_pool_returns_empty():
    step = make_step("Python", "Internship")
    profile = make_test_profile()
    results = match_opportunities_for_step(step, profile, [])
    assert results == []


def test_match_opportunities_respects_limit():
    opportunities = make_opportunity_pool() * 3  # force more than 3 candidates
    step = make_step("Anything", "Nonexistent")  # forces match_level 4 (all candidates)
    profile = make_test_profile()
    results = match_opportunities_for_step(step, profile, opportunities, limit=2)
    assert len(results) == 2


def test_match_opportunities_never_invents_an_opportunity():
    # Every returned opportunity must be one of the exact objects passed
    # in -- nothing fabricated, regardless of match level.
    opportunities = make_opportunity_pool()
    profile = make_test_profile()
    for skill, category in [("SQL", "Internship"), ("Nope", "Nope"), ("Python", "Bootcamp")]:
        step = make_step(skill, category)
        results = match_opportunities_for_step(step, profile, opportunities)
        for r in results:
            assert r["opportunity"] in opportunities


def test_attach_opportunities_to_roadmap_adds_opportunities_key():
    opportunities = make_opportunity_pool()
    profile = make_test_profile()
    roadmap = {
        "summary": "test roadmap",
        "steps": [make_step("SQL", "Internship"), make_step("Git", "Workshop")],
        "source": "fallback",
    }
    result = attach_opportunities_to_roadmap(roadmap, profile, opportunities)
    assert len(result["steps"]) == 2
    for step in result["steps"]:
        assert "opportunities" in step
        assert isinstance(step["opportunities"], list)


def test_attach_opportunities_to_roadmap_does_not_mutate_input():
    opportunities = make_opportunity_pool()
    profile = make_test_profile()
    roadmap = {
        "summary": "test roadmap",
        "steps": [make_step("SQL", "Internship")],
        "source": "fallback",
    }
    attach_opportunities_to_roadmap(roadmap, profile, opportunities)
    assert "opportunities" not in roadmap["steps"][0]


def test_attach_opportunities_to_roadmap_preserves_step_fields():
    opportunities = make_opportunity_pool()
    profile = make_test_profile()
    roadmap = {
        "summary": "test roadmap",
        "steps": [make_step("SQL", "Internship")],
        "source": "ai",
    }
    result = attach_opportunities_to_roadmap(roadmap, profile, opportunities)
    step = result["steps"][0]
    assert step["relevant_skill"] == "SQL"
    assert step["opportunity_category"] == "Internship"
    assert step["task_id"] is None
    assert result["summary"] == "test roadmap"
    assert result["source"] == "ai"