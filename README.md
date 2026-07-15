## Student Level Classification (Feature 1 issue #12,13,14)

The platform classifies a student's level using explicit, testable rules
based on `year`, `courses` (number of courses taken), and `skills`
(number of skills listed).

### Rules

Checked in order — the first matching rule applies:

1. `courses >= 8 AND skills >= 6` → **Advanced** (internship-ready)
2. `courses >= 5 OR skills >= 4` → **Intermediate**
3. `year == 1 AND courses < 5 AND skills < 3` → **Beginner**
4. Otherwise → **Intermediate** (fallback — e.g. a Year 2+ student who
   hasn't hit the Advanced or Beginner criteria; open question for the
   team on whether this should behave differently)

Experience thresholds (rules 1 and 2) are checked **before** the
year-based Beginner rule, so a Year 1 student with enough courses or
skills is classified by their experience, not capped by their year.

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

### Known bug found during testing (flagged to Member 3)

The `students` table has no `UNIQUE` constraint on `user_id`, so
calling `POST /student-profile` twice for the same user creates two
separate rows instead of updating the existing one. Since
`GET /student/profile/{user_id}` (and this analyze endpoint) use
`.fetchone()`, which row gets returned is arbitrary when duplicates
exist. Suggested fix: add `UNIQUE(user_id)` to `students` in
`schema.sql`, and change `POST /student-profile` to upsert
(`INSERT ... ON CONFLICT (user_id) DO UPDATE ...`) instead of always
inserting.

### Known open questions (raise with team)

- The design doc lists 4 levels (Beginner, Intermediate, Ready-for-internships-with-gaps,
  Not-yet-ready); this implementation currently covers the 3 from Issue 1
  (Beginner/Intermediate/Advanced) as a placeholder.
- Fallback case (rule 4 above) isn't explicitly defined by the original
  thresholds and needs sign-off.