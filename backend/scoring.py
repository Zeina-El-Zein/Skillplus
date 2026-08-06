from datetime import date

# Difficulty ordering
LEVELS = {
    "Beginner": 0,
    "Intermediate": 1,
    "Advanced": 2,
}


def score_opportunity(profile, opportunity):
    """
    Scores an opportunity against a student profile.

    Returns:
        (score, reasons)

    score: integer between 0 and 100
    reasons: list of strings explaining the match
    """

    score = 0
    reasons = []

    # -----------------------------
    # Safe lookups
    # -----------------------------
    student_major = profile.get("major")
    student_level = profile.get("level")
    student_skills = profile.get("current_skills") or []
    student_interests = profile.get("interests") or []
    preferred_type = profile.get("preferred_opportunity_type")

    opportunity_major = opportunity.get("suitable_major")
    opportunity_level = opportunity.get("difficulty")
    required_skills = opportunity.get("required_skills") or []
    category = opportunity.get("category")

    # -----------------------------
    # Major (30 / 15)
    # -----------------------------
    if (
        student_major
        and opportunity_major
        and student_major == opportunity_major
    ):
        score += 30
        reasons.append("Matches your major")

    elif opportunity_major == "Any":
        score += 15
        reasons.append("Open to all majors")

    # -----------------------------
    # Difficulty (25 / 10 / 0)
    # -----------------------------
    if (
        student_level in LEVELS
        and opportunity_level in LEVELS
    ):
        difference = abs(
            LEVELS[student_level] - LEVELS[opportunity_level]
        )

        if difference == 0:
            score += 25
            reasons.append("Suitable for your experience level")

        elif difference == 1:
            score += 10
            reasons.append("Close to your experience level")

    # -----------------------------
    # Skills (5 each, max 20)
    # -----------------------------
    matching_skills = list(
        set(student_skills) & set(required_skills)
    )[:4]

    score += len(matching_skills) * 5

    for skill in matching_skills:
        reasons.append(f"Uses your {skill} skill")

    # -----------------------------
    # Interest (15)
    # -----------------------------
    if category and category in student_interests:
        score += 15
        reasons.append("Matches one of your interests")

    # -----------------------------
    # Preferred opportunity type (10)
    # -----------------------------
    if (
        preferred_type
        and category
        and preferred_type == category
    ):
        score += 10
        reasons.append("Matches your preferred opportunity type")

    return score, reasons


def filter_active_opportunities(opportunities, today=None):
    """
    Removes expired opportunities.

    Rules:
    - deadline < today  -> expired
    - deadline == today -> active
    - deadline is None  -> active
    """

    if today is None:
        today = date.today()

    active = []

    for opportunity in opportunities:
        deadline = opportunity.get("deadline")

        if deadline is None:
            active.append(opportunity)
        elif deadline >= today:
            active.append(opportunity)

    return active