from datetime import date
import re


LEVELS = {
    "Beginner": 0,
    "Intermediate": 1,
    "Advanced": 2,
}


WEIGHTS = {
    "major": 20,
    "difficulty": 15,
    "skills": 20,
    "interests": 10,
    "opportunity_type": 5,
    "suitable_year": 10,
    "time": 10,
    "career_goal": 10,
}


STOP_WORDS = {
    "a", "an", "and", "are", "be", "become", "for", "from", "in", "into",
    "of", "on", "or", "the", "to", "with", "work", "working",
}


def _normalize(value):
    if value is None:
        return ""
    return str(value).strip().lower()


def _tokens(value):
    if not value:
        return set()
    words = re.findall(r"[a-z0-9]+", _normalize(value))
    return {word for word in words if word not in STOP_WORDS}


def _value_list(values):
    if not values:
        return []
    return [_normalize(value) for value in values if value is not None and _normalize(value)]


def _score_major(student_major, opportunity_major):
    student_major = _normalize(student_major)
    opportunity_major = _normalize(opportunity_major)
    if not student_major or not opportunity_major:
        return 0, None
    if opportunity_major == "any":
        return WEIGHTS["major"] // 2, "Open to all majors"
    if student_major == opportunity_major:
        return WEIGHTS["major"], "Matches your major"
    return 0, None


def _score_difficulty(student_level, opportunity_level):
    student_level = _normalize(student_level).title()
    opportunity_level = _normalize(opportunity_level).title()
    if student_level not in LEVELS or opportunity_level not in LEVELS:
        return 0, None
    difference = abs(LEVELS[student_level] - LEVELS[opportunity_level])
    if difference == 0:
        return WEIGHTS["difficulty"], "Suitable for your experience level"
    if difference == 1:
        return 7, "Close to your experience level"
    return 0, None


def _score_skills(student_skills, required_skills):
    student_skills = _value_list(student_skills)
    required_skills = _value_list(required_skills)
    if not student_skills or not required_skills:
        return 0, []
    student_skill_set = set(student_skills)
    matching_skills = [skill for skill in required_skills if skill in student_skill_set]
    matching_skills = list(dict.fromkeys(matching_skills))
    matching_skills = matching_skills[:4]
    score = len(matching_skills) * 5
    reasons = [f"Uses your {skill} skill" for skill in matching_skills]
    return score, reasons


def _score_interests(student_interests, opportunity):
    if not student_interests:
        return 0, None
    opportunity_text = " ".join([
        str(opportunity.get("title") or ""),
        str(opportunity.get("category") or ""),
        " ".join(opportunity.get("skills_gained") or []),
    ])
    opportunity_tokens = _tokens(opportunity_text)
    if not opportunity_tokens:
        return 0, None
    for interest in student_interests:
        interest_tokens = _tokens(interest)
        if interest_tokens & opportunity_tokens:
            return (WEIGHTS["interests"], "Matches one of your interests")
    return 0, None


def _score_opportunity_type(preferred_type, category):
    preferred_type = _normalize(preferred_type)
    category = _normalize(category)
    if not preferred_type or not category:
        return 0, None
    if preferred_type == category:
        return (WEIGHTS["opportunity_type"], "Matches your preferred opportunity type")
    return 0, None


def _score_year(student_year, opportunity_year):
    if student_year is None:
        return 0, None
    if opportunity_year is None:
        return 5, "Suitable year is not specified"
    try:
        student_year = int(student_year)
        opportunity_year = int(opportunity_year)
    except (TypeError, ValueError):
        return 0, None
    difference = abs(student_year - opportunity_year)
    if difference == 0:
        return WEIGHTS["suitable_year"], "Suitable for your year of study"
    if difference == 1:
        return 5, "Close to your year of study"
    return 0, None


def _score_time(available_time, opportunity_hours):
    if available_time is None:
        return 0, None
    if opportunity_hours is None:
        return 5, "Weekly time commitment is not specified"
    try:
        available_time = int(available_time)
        opportunity_hours = int(opportunity_hours)
    except (TypeError, ValueError):
        return 0, None
    difference = opportunity_hours - available_time
    if difference <= 0:
        return WEIGHTS["time"], "Fits your available time"
    if difference <= 5:
        return 5, "Slightly above your available time"
    return 0, None


def _score_career_goal(profile, opportunity):
    career_goal = profile.get("career_goal")
    if not career_goal:
        return 0, None
    opportunity_text = " ".join([
        str(opportunity.get("title") or ""),
        str(opportunity.get("category") or ""),
        " ".join(opportunity.get("skills_gained") or []),
        str(opportunity.get("cv_benefit") or ""),
    ])
    career_tokens = _tokens(career_goal)
    opportunity_tokens = _tokens(opportunity_text)
    if not career_tokens or not opportunity_tokens:
        return 0, None
    if career_tokens & opportunity_tokens:
        return (WEIGHTS["career_goal"], "Supports your career goal")
    return 0, None


def score_opportunity(profile, opportunity):
    score = 0
    reasons = []

    student_major = profile.get("major")
    student_level = profile.get("level")
    student_skills = profile.get("current_skills") or []
    student_interests = profile.get("interests") or []
    preferred_type = profile.get("preferred_opportunity_type")
    student_year = profile.get("year_of_study")
    available_time = profile.get("available_time_per_week")

    opportunity_major = opportunity.get("suitable_major")
    opportunity_level = opportunity.get("difficulty")
    required_skills = opportunity.get("required_skills") or []
    category = opportunity.get("category")
    opportunity_year = opportunity.get("suitable_year")
    opportunity_hours = opportunity.get("hours_per_week")

    points, reason = _score_major(student_major, opportunity_major)
    score += points
    if reason: reasons.append(reason)

    points, reason = _score_difficulty(student_level, opportunity_level)
    score += points
    if reason: reasons.append(reason)

    points, skill_reasons = _score_skills(student_skills, required_skills)
    score += points
    reasons.extend(skill_reasons)

    points, reason = _score_interests(student_interests, opportunity)
    score += points
    if reason: reasons.append(reason)

    points, reason = _score_opportunity_type(preferred_type, category)
    score += points
    if reason: reasons.append(reason)

    points, reason = _score_year(student_year, opportunity_year)
    score += points
    if reason: reasons.append(reason)

    points, reason = _score_time(available_time, opportunity_hours)
    score += points
    if reason: reasons.append(reason)

    points, reason = _score_career_goal(profile, opportunity)
    score += points
    if reason: reasons.append(reason)

    score = min(score, 100)
    return score, reasons


def filter_active_opportunities(opportunities, today=None):
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


def _step_matches_opportunity(step, opportunity):
    category_match = (
        step.get("opportunity_category")
        and opportunity.get("category") == step.get("opportunity_category")
    )

    relevant_skill = step.get("relevant_skill")
    skill_match = False
    if relevant_skill:
        skill_lower = str(relevant_skill).strip().lower()
        opp_skills = (opportunity.get("required_skills") or []) + (
            opportunity.get("skills_gained") or []
        )
        skill_match = any(
            skill_lower == str(s).strip().lower() for s in opp_skills
        )

    return category_match, skill_match


def match_opportunities_for_step(step, profile, opportunities, limit=3):
    """
    Finds real opportunities from `opportunities` that fit a single
    roadmap step, ranked by the student's normal fit score.

    Matching narrows progressively so a step is never left with zero
    opportunities just because nothing hits the strictest match:
      1. category AND relevant_skill both match
      2. category match OR relevant_skill match (either one alone)
         -- these are pooled together and ranked purely by fit score,
         rather than treating "same category label" as a stronger signal
         than "actually teaches the target skill". A step's
         relevant_skill is the specific reason the step exists, so an
         opportunity that teaches that skill shouldn't be buried behind
         one that merely shares a category but is otherwise irrelevant.
      3. no filter -- top overall fits for this student (last resort, so
         the roadmap always has *something* to show next to a step)

    Returns a list of {"opportunity": ..., "score": ..., "reasons": ...}
    sorted by score, descending, at most `limit` entries. Each entry also
    carries "match_level" (1-3) so the frontend can distinguish a
    strong/direct match from a last-resort suggestion -- callers should
    treat match_level 3 as "no direct match, showing a general
    recommendation instead" rather than presenting it as equally
    relevant to levels 1-2.
    """

    def score_all(candidates):
        scored = []
        for opp in candidates:
            score, reasons = score_opportunity(profile, opp)
            scored.append({"opportunity": opp, "score": score, "reasons": reasons})
        scored.sort(key=lambda r: r["score"], reverse=True)
        return scored

    both = []
    either = []
    for opp in opportunities:
        category_match, skill_match = _step_matches_opportunity(step, opp)
        if category_match and skill_match:
            both.append(opp)
        elif category_match or skill_match:
            either.append(opp)

    for match_level, candidates in (
        (1, both),
        (2, either),
        (3, opportunities),
    ):
        if candidates:
            results = score_all(candidates)[:limit]
            for r in results:
                r["match_level"] = match_level
            if results:
                return results

    return []


def attach_opportunities_to_roadmap(roadmap, profile, opportunities, limit=3):
    new_steps = []
    for step in roadmap.get("steps", []):
        new_step = dict(step)
        new_step["opportunities"] = match_opportunities_for_step(
            step, profile, opportunities, limit=limit
        )
        new_steps.append(new_step)

    new_roadmap = dict(roadmap)
    new_roadmap["steps"] = new_steps
    return new_roadmap