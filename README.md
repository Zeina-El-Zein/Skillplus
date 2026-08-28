# Skill+

Skill+ is a web platform that helps university students turn a vague sense of
"I should be building my CV" into a concrete, personalised plan.

A student creates a profile describing their major, year of study, courses,
skills, interests and available time. Skill+ classifies their experience level
using explicit, testable rules, ranks real opportunities (internships,
workshops, hackathons, competitions and courses) by how well each one fits that
student, and generates a personalised roadmap that turns those matches into
ordered, trackable steps.

Institutions have their own accounts. They can paste an opportunity description
in plain text, have it structured automatically, review and edit every field
before publishing, and then see how many students viewed each opportunity and
added it to their to-do list.

**Repository:** https://github.com/Zeina-El-Zein/Skillplus  
**Contact:** skillplus.teamm@gmail.com

---

## Team

| Member | Area of responsibility |
|---|---|
| Zeina El-Zein | Database schema, opportunity data, institution dashboard and engagement analytics |
| Sara Noun | Authentication, password reset, sessions, to-do system and task API |
| Sara Chmayssani | Student profile API, recommendations, dashboard and persistence |
| Mufaro Dube | Level classification, recommendation scoring, AI prompts and roadmap generation |
| Abdul Kader | Frontend application, navigation, role-aware flows and UI |

---

## Tech stack

- **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui, built with Vite
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL
- **AI:** Google Gemini via the Google GenAI Python SDK, with a rules-based
  fallback so the application remains fully usable without an API key

---

## Main features

- Student and institution accounts with routing based on roles and authorization
- Password reset with hashed, single-use, expiring tokens
- Student profile with level classification based on rules (Beginner/Intermediate/Advanced)
- Opportunity recommendations with a transparent 100-point scoring formula and
  a written reason for every match
- Personalised roadmap with steps that link to real opportunities from the database
- Shared to-do system: To Do / In Progress / Done, synchronised across the
  dashboard, roadmap and to-do page
- Institution portal: paste a description, review the structured draft, publish
- Overall Institutional Metrics (views and to-do additions),
  never exposing individual student activity

---

## Project structure

```
Code/
├── backend/           FastAPI application, database schema and seed data
│   ├── main.py        API endpoints
│   ├── schema.sql     Database tables
│   ├── seed.sql       Curated sample opportunities
│   ├── scoring.py     Recommendation scoring
│   ├── prompts.py     AI prompts, validation and rules-based fallback
│   └── README.md      Full API documentation
└── frontend/homepage/ React application
    └── README.md      Frontend routes and flows
```

---

## Getting started

### Prerequisites

- PostgreSQL 17 or later
- Python 3.11 or later
- Node.js 18 or later

### 1. Clone the repository

```bash
git clone https://github.com/Zeina-El-Zein/Skillplus.git
cd Skillplus
```

### 2. Create the database

```bash
psql -U postgres -c "CREATE DATABASE skillplus;"
psql -U postgres -d skillplus -f backend/schema.sql
psql -U postgres -d skillplus -f backend/seed.sql
```

These commands will prompt for your PostgreSQL password, the one you chose when installing PostgreSQL.
Use that same password in DATABASE_URL.
`schema.sql` creates all tables. `seed.sql` loads 22 curated sample
opportunities and can be re-run at any time to reset that data.

### 3. Configure the backend

Create a file named `.env` inside `backend/`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/skillplus
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Only `DATABASE_URL` is required. Without a Gemini key the application still
runs: roadmap generation and opportunity extraction fall back to the
rules-based path and are labelled accordingly in the interface.

A free Gemini key can be created at https://aistudio.google.com.

Password-reset emails additionally require:

```env
SMTP_EMAIL=your-address@gmail.com
SMTP_APP_PASSWORD=your-gmail-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

Without these, the reset link is printed to the backend terminal instead.
`.env` is excluded by `.gitignore` and must never be committed.

### 4. Run the backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

The API runs at http://127.0.0.1:8000 and interactive documentation is
available at http://127.0.0.1:8000/docs.

### 5. Run the frontend

In a second terminal:

```bash
cd frontend/homepage
npm install
npm run dev
```

The application runs at http://localhost:5173.

---

## Trying the application

**As a student:** sign up, log in, complete the profile form, view the analysis
of your level, browse ranked recommendations, add opportunities to your to-do
list, and generate a roadmap.

**As an institution:** sign up choosing the institution role, open the
institution dashboard, paste an opportunity description, review and edit the
structured draft, publish it, and view engagement statistics for your
opportunities.

---

## Testing

Backend:

```bash
cd backend
python -m pytest -v
```

Frontend:

```bash
cd frontend/homepage
npm run test:run
```

---

## Documentation

- [`backend/README.md`](backend/README.md) — full API reference, database
  schema, scoring weights and shared value contracts
- [`frontend/homepage/README.md`](frontend/homepage/README.md) — routes, flows
  and frontend verification

---

## Implementation notes

The sections below document individual features in more detail, including the
classification rules, the recommendation endpoint and the frontend flows.


## Student Level Classification

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

analysis is a **separate call**
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


---

## Recommendation Endpoint 

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
      "title": "Python for Engineers Bootcamp",
      "category": "Bootcamp",
      "suitable_major": "Any",
      "suitable_year": 1,
      "difficulty": "Beginner",
      "required_skills": [],
      "skills_gained": [
        "Python",
        "Programming Basics"
      ],
      "deadline": "2026-10-15",
      "estimated_time": "6 weeks",
      "cv_benefit": "First programming credential - the entry point for every technical role.",
      "link": "https://www.freecodecamp.org/learn",
      "hours_per_week": 6,
      "institution_name": null,
      "institution_logo": null,
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

---

## Frontend

The frontend supports both roles returned by authentication.

### Student flow

~~~text
signup → login → profile/dashboard → results → matches → roadmap → to-do
~~~

Signup creates the account and returns to `/login`; it does not create a browser session or log the user in automatically. Login follows the final shared routing contract: a student without a completed profile goes to `/profile`, a returning student with a profile goes to `/dashboard`, and an institution goes to `/institution/dashboard`.

Returning students can use the shared navigation on every student page to move between `/dashboard`, `/profile`, `/results`, `/recommendations`, `/roadmap`, and `/todo`. The active page is highlighted and Profile remains available for editing.

The roadmap screen uses `GET /student/{user_id}/roadmap` and `POST /student/{user_id}/roadmap`. It shows cached, animated generation, loading, missing, error, retry, AI-assisted and rules-based fallback states. Generated roadmaps are cached by the backend, visibly marked as saved, and each roadmap step can be added to the student's To-Do list.

Student profile pictures use `POST /student/{user_id}/profile-picture`. Existing profiles and picture paths can be restored with `GET /student/profile/{user_id}`.

### Institution flow

~~~text
signup → dashboard/profile → description → editable review → publish
~~~

The institution screens use:

~~~http
GET  /institution/{user_id}
POST /institution-profile
POST /institution/{user_id}/logo
POST /institution/opportunities/process
POST /institution/opportunities
GET  /institution/{user_id}/opportunities
GET  /institution/{user_id}/opportunities/all
~~~

The process endpoint only prepares a draft. The institution must review and edit every field before the final save request. Fallback drafts are labeled `Generated offline`.

The dashboard also displays the institution's previously published opportunities, the shared catalog, and the `views` and `added_to_todo` engagement values returned by the backend. Student opportunity-detail clicks are recorded through `POST /opportunities/{opportunity_id}/view?user_id={user_id}`.

### Homepage accuracy

Unsupported user counts, accuracy percentages, opportunity-volume claims, the Demo button, internal/developer-facing copy, and non-functional Privacy/Terms links were removed. Rule-based analysis and scoring are described separately from AI-assisted opportunity extraction and roadmap generation. One reusable About/footer component appears across the public and application pages and links the contact address `skillplus.teamm@gmail.com`.

### Frontend verification

~~~bash
cd frontend/homepage
npm ci
npm run test:run
npm run build
~~~

The frontend suite contains 32 passing tests. It covers both role flows, explicit login after signup, `has_profile` routing, session expiry, the six-link student navigation, results restoration after a fresh login, exact API payloads, image uploads, role guards, institution history/engagement data, To-Do integration, fallback behavior, roadmap caching/generation/error/animation states, and all previously implemented Member 5 behavior. The integrated backend suite contains 96 passing tests.
