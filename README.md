## Student Level Classification (Issue #12)

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

`POST /student/analyze`

Currently a separate endpoint from `POST /student/profile` (proposed —
pending confirmation with Member 3). Auto-triggering after profile
creation is a possible alternative.

### Example input/output

**Request**
```json
{
  "year": 1,
  "courses": 10,
  "skills": 7
}
```

**Response**
```json
{
  "level": "Advanced",
  "strengths": ["10 course(s) completed", "7 skill(s) acquired"],
  "missing": [],
  "next_step": "You're internship-ready — start applying to internship opportunities."
}
```

**Another example — Beginner**

Request: `{"year": 1, "courses": 2, "skills": 1}`

Response:
```json
{
  "level": "Beginner",
  "strengths": ["2 course(s) completed", "1 skill(s) acquired"],
  "missing": ["3 more course(s) to reach Intermediate", "3 more skill(s) to reach Intermediate"],
  "next_step": "Focus on foundational courses and building your first skills."
}
```

### Known open questions

- The design doc lists 4 levels (Beginner, Intermediate, Ready-for-internships-with-gaps,
  Not-yet-ready); this implementation currently covers the 3 from Issue 1
  (Beginner/Intermediate/Advanced) as a placeholder.
- The exact `profile` input shape depends on Issue 8 — `year`/`courses`/`skills`
  are assumed as integer counts; confirm this matches the finalized profile schema.
- Fallback case (rule 4 above) isn't explicitly defined by the original
  thresholds and needs sign-off.
