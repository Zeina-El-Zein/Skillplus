## Student Level Classification (Feature 1 issue #12,13,14)

The platform classifies a student's level using explicit, testable rules
based on `year`, `courses` (number of courses taken), and `skills`
(number of skills listed).

### Rules

Checked in order — the first matching rule applies:

1. `courses >= 8 AND skills >= 6` → **Advanced** (internship-ready)
2. `courses >= 5 OR skills >= 4` → **Intermediate**
3. `courses < 5 AND skills < 3` → **Beginner** (any year)
4. Otherwise → **Intermediate** (fallback — e.g. exactly 3 skills and fewer than 5 courses)

Experience thresholds (rules 1 and 2) are checked **before** the
Beginner rule, so a student with enough courses or skills is classified
by their experience.

### Endpoint

`POST /student/analyze/{user_id}`

Matches the existing `GET /student/profile/{user_id}` pattern already in
`main.py`. No request body — it looks up the student's already-saved
profile from the `students` table (via `user_id`), classifies it, and
writes the result into the `level` column on that row (schema.sql
already has this column reserved for it).

This settles Issue 8's open question: analysis is a **separate call**
from `POST /student-profile`, triggered by hitting this endpoint
afterward (e.g. from the frontend, right after profile save succeeds).

### Example input/output

**Request**
```
POST /student/analyze/2
```
(no body — `user_id` comes from the path, same as the existing profile endpoints)

**Response**
```json
{
  "user_id": 2,
  "level": "Advanced",
  "strengths": ["10 course(s) completed", "7 skill(s) acquired"],
  "missing": [],
  "next_step": "You're internship-ready — start applying to internship opportunities."
}
```

**If no profile exists for that user:**
```json
{
  "detail": "Student profile not found."
}
```
(404, matching the style of the existing `GET /student/profile/{user_id}` endpoint)

**Beginner example**
```
POST /student/analyze/3
```
```json
{
  "user_id": 3,
  "level": "Beginner",
  "strengths": ["2 course(s) completed", "1 skill(s) acquired"],
  "missing": ["3 more course(s) to reach Intermediate", "3 more skill(s) to reach Intermediate"],
  "next_step": "Focus on foundational courses and building your first skills."
}
```

### Testing status

Verified end-to-end against a real local PostgreSQL database (not just
unit tests): signup → create profile → analyze, for both a Beginner
case (2 courses / 1 skill) and an Advanced case (10 courses / 7
skills). Both returned the correct level and correctly wrote it to the
`level` column in `students`. Unit tests for the pure classification
logic (`test_classification.py`) also pass, including the Year-1-
experienced edge case from Issue 1's acceptance criteria.

### Profile update behavior

The `students.user_id` column is unique, and `POST /student-profile`
uses an upsert (`INSERT ... ON CONFLICT (user_id) DO UPDATE`). Submitting
the form again updates the existing profile instead of creating a duplicate.

### Known open questions (raise with team)

- The design doc lists 4 levels (Beginner, Intermediate, Ready-for-internships-with-gaps,
  Not-yet-ready); this implementation currently covers the 3 from Issue 1
  (Beginner/Intermediate/Advanced) as a placeholder.
- Fallback case (rule 4 above) rounds up to Intermediate according to the current team decision.

---

## Recommendation Endpoint (Feature 3 Issue #29)

The recommendation endpoint compares one analyzed student profile with all active opportunities in the database.

Each active opportunity is passed to the scoring function in `scoring.py`. The endpoint adds the calculated match score and matching reasons, sorts the results from highest score to lowest, and returns the ranked opportunities.

### Endpoint

```http
GET /student/{user_id}/recommendations
```

No request body is required. The `user_id` is provided in the URL.

### Recommendation Flow

1. Load the student profile using `user_id`.
2. Return `404` if the student profile does not exist.
3. Return `400` if the student profile has not been analyzed and its `level` is still `NULL`.
4. Load all active opportunities.
5. Exclude opportunities whose deadlines have passed.
6. Call `score_opportunity(profile, opportunity)` for every active opportunity.
7. Add `match_score` and `reasons` to every opportunity.
8. Sort the recommendations from highest score to lowest.
9. Return all active opportunities in ranked order.

### Scoring Integration

The endpoint imports:

```python
from scoring import score_opportunity
```

The scoring function is called using:

```python
match_score, reasons = score_opportunity(
    profile,
    opportunity
)
```

The scoring function considers:

- student major;
- student level and opportunity difficulty;
- matching skills;
- student interests;
- preferred opportunity type.

### Example Successful Request

```http
GET /student/1/recommendations
```

### Example Successful Response

```json
{
  "user_id": 1,
  "recommendations": [
    {
      "id": 1,
      "title": "Python Beginner Bootcamp",
      "category": "Bootcamp",
      "suitable_major": "Any",
      "suitable_year": 1,
      "difficulty": "Beginner",
      "required_skills": [],
      "skills_gained": [
        "Python",
        "Problem Solving"
      ],
      "deadline": null,
      "estimated_time": null,
      "cv_benefit": "Adds programming foundation to CV",
      "link": "https://example.com/1",
      "hours_per_week": null,
      "match_score": 40,
      "reasons": [
        "Open to all majors",
        "Suitable for your experience level"
      ]
    }
  ]
}
```

The real response may contain multiple recommendations. Results are ordered from highest `match_score` to lowest.

### Unknown Student Response

If no student profile exists for the supplied `user_id`, the endpoint returns status code `404`.

```json
{
  "detail": "Student profile not found."
}
```

### Unanalyzed Profile Response

If the student profile exists but its `level` is still `NULL`, the endpoint returns status code `400`.

```json
{
  "detail": "Student profile must be analyzed before recommendations."
}
```

The frontend should call:

```http
POST /student/analyze/{user_id}
```

before requesting recommendations again.

### Empty Opportunities Behavior

If no active opportunities exist, the endpoint returns status code `200` with an empty recommendations list.

```json
{
  "user_id": 1,
  "recommendations": []
}
```

### Result Count Decision

For the current project stage, the endpoint returns all active opportunities, sorted from highest score to lowest.

This can later be changed to the top 5 recommendations using:

```python
recommendations[:5]
```

### Testing Status

The recommendations endpoint was tested through FastAPI Swagger against a local PostgreSQL database.

Verified cases:

- analyzed student returned `200`;
- every opportunity included `match_score`;
- every opportunity included `reasons`;
- scores were returned in descending order: `40, 40, 20, 15, 10`;
- unknown student returned `404`;
- unanalyzed student profile returned `400`;
- expired opportunities were excluded by the SQL query;
- `NULL` student arrays are handled safely by the scoring function using `or []`.