# Skill+ Backend

Backend for Skill+, a student opportunity recommendation platform.

The backend is built with FastAPI and PostgreSQL and supports:

- user authentication;
- student profiles and level analysis;
- institution accounts;
- opportunity browsing;
- opportunity recommendation scoring;
- institution-submitted opportunities;
- AI-assisted opportunity extraction;
- AI-generated student roadmaps with rule-based fallback and caching.

---

# Database Setup

## Requirements

- PostgreSQL 17.10
- `psql`
- Python 3.11+

---

## Step 1 — Install PostgreSQL

Install PostgreSQL on your computer.

---

## Step 2 — Create the database

Open a terminal and run:

```bash
psql -U postgres
```

Inside PostgreSQL:

```sql
CREATE DATABASE skillplus;
\q
```

---

## Step 3 — Run the schema

From the main project folder:

```bash
psql -U postgres -d skillplus -f backend/schema.sql
```

The schema creates the required database tables.

---

## Step 4 — Load sample opportunities

Run:

```bash
psql -U postgres -d skillplus -f backend/seed.sql
```

The seed file loads the curated sample opportunities used by the recommendation system.

It can be re-run when the team needs to reset the sample opportunity data.

---

## Step 5 — Create the `.env` file

Create:

```text
backend/.env
```

Example:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/skillplus
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Replace:

```text
YOUR_PASSWORD
```

with your local PostgreSQL password.

Replace:

```text
YOUR_GEMINI_API_KEY
```

with your Gemini API key from Google AI Studio.

Never commit `.env`.

The file is excluded through `.gitignore`.

---

## Step 6 — Install dependencies

Open a terminal inside `backend/` and run:

```bash
pip install -r requirements.txt
```

---

# Database Tables

The backend currently uses the following tables:

- `users` — user accounts and roles;
- `password_reset_tokens` — secure temporary password-reset tokens;
- `students` — student profiles and analyzed levels;
- `institutions` — institution profiles linked to institution users;
- `opportunities` — seed and institution-submitted opportunities;
- `roadmaps` — cached student roadmaps;
- `student_tasks` — shared student to-do/progress tasks;
- `opportunity_interactions` — opportunity views and add-to-To-Do events.

---

# User Roles

Skill+ supports two user roles:

```text
student
institution
```

The role is selected during signup.

Institution-only actions use the reusable:

```python
require_institution(user_id, db)
```

function from:

```text
backend/authorization.py
```

It provides the following behavior:

- nonexistent user → `404 Not Found`;
- user exists but is not an institution → `403 Forbidden`;
- institution user → request may continue.

---

# Authentication API

The authentication endpoints are:

```text
POST /auth/signup
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
```

---

## POST `/auth/signup`

Creates a user.

Example:

```json
{
  "name": "Firas Test",
  "email": "firas.test@example.com",
  "password": "OldPassword123",
  "role": "student"
}
```

The role must be either:

```text
student
institution
```

Example response:

```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "name": "Firas Test",
    "email": "firas.test@example.com",
    "role": "student"
  }
}
```

Duplicate email:

```json
{
  "detail": "Email already registered"
}
```

---

## POST `/auth/login`

Example:

```json
{
  "email": "firas.test@example.com",
  "password": "OldPassword123"
}
```

Successful response:

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "name": "Firas Test",
    "email": "firas.test@example.com",
    "role": "student"
  }
}
```

Invalid login:

```json
{
  "detail": "Invalid email or password"
}
```

---

## POST `/auth/forgot-password`

Example:

```json
{
  "email": "firas.test@example.com"
}
```

Response:

```json
{
  "message": "If an account exists, password reset instructions have been sent."
}
```

For security, the response does not reveal whether the supplied email exists.

During local development, the reset link is printed in the backend terminal.

Example:

```text
http://localhost:5173/reset-password?token=RESET_TOKEN
```

The token:

- expires after 30 minutes;
- is one-time use;
- is invalidated when a newer token is created;
- is hashed before being stored.

---

## POST `/auth/reset-password`

Example:

```json
{
  "token": "RESET_TOKEN_FROM_THE_LINK",
  "new_password": "NewPassword456"
}
```

Successful response:

```json
{
  "message": "Password reset successfully."
}
```

Invalid/expired token:

```json
{
  "detail": "Invalid or expired password reset token."
}
```

Password-reset security includes:

- secure random token generation;
- SHA-256 token hashing;
- bcrypt password hashing;
- 30-minute expiry;
- one-time token use;
- invalidation of older active tokens;
- account-enumeration protection.

---

# Student Profile API

The student profile endpoints are:

```text
POST /student-profile
GET /student/profile/{user_id}
POST /student/analyze/{user_id}
```

---

## POST `/student-profile`

Creates or updates one profile per student user.

Example:

```json
{
  "user_id": 2,
  "major": "Computer and Communications Engineering",
  "year_of_study": 3,
  "courses_taken": [
    "Data Structures",
    "Database Systems"
  ],
  "current_skills": [
    "Python",
    "SQL"
  ],
  "interests": [
    "Backend Development",
    "Artificial Intelligence"
  ],
  "career_goal": "Become a backend developer",
  "available_time_per_week": 8,
  "preferred_opportunity_type": "Internship"
}
```

Response:

```json
{
  "message": "Student profile saved successfully",
  "student_id": 4
}
```

The endpoint uses an upsert, so resubmitting the profile updates the existing row instead of creating a duplicate.

### Roadmap cache invalidation

A roadmap depends on the student's profile.

Therefore, when the profile is updated through:

```text
POST /student-profile
```

any cached roadmap for that user is deleted.

A later roadmap request will then use the updated profile.

---

## GET `/student/profile/{user_id}`

Example:

```text
GET /student/profile/2
```

Example response:

```json
{
  "student_id": 4,
  "user_id": 2,
  "major": "Computer and Communications Engineering",
  "year_of_study": 3,
  "courses_taken": [
    "Data Structures",
    "Database Systems"
  ],
  "current_skills": [
    "Python",
    "SQL"
  ],
  "interests": [
    "Backend Development",
    "Artificial Intelligence"
  ],
  "career_goal": "Become a backend developer",
  "available_time_per_week": 8,
  "preferred_opportunity_type": "Internship",
  "level": "Beginner"
}
```

Missing profile:

```json
{
  "detail": "Student profile not found."
}
```

The `level` is `null` until analysis has been performed.

---

# Student Level Classification

Endpoint:

```text
POST /student/analyze/{user_id}
```

No request body is required.

The endpoint loads the existing student profile, analyzes it, and stores the resulting level.

Current classification rules are evaluated in order:

1. `courses >= 8 AND skills >= 6` → `Advanced`
2. `courses >= 5 OR skills >= 4` → `Intermediate`
3. `courses < 5 AND skills < 3` → `Beginner`
4. otherwise → `Intermediate`

Example:

```text
POST /student/analyze/2
```

Response:

```json
{
  "user_id": 2,
  "level": "Beginner",
  "strengths": [
    "2 course(s) completed",
    "2 skill(s) acquired"
  ],
  "missing": [
    "3 more course(s) to reach Intermediate",
    "1 more skill(s) to reach Intermediate"
  ],
  "next_step": "Focus on foundational courses and building your first skills."
}
```

Missing profile:

```json
{
  "detail": "Student profile not found."
}
```

---

# Institution Accounts

## POST `/institution-profile`

Creates or updates an institution profile.

Only institution users are allowed.

Example:

```json
{
  "user_id": 3,
  "institution_name": "Example Institution",
  "website": "https://example.com",
  "description": "Example institution description"
}
```

Response:

```json
{
  "message": "Institution profile saved successfully",
  "institution_id": 1
}
```

Student user:

```json
{
  "detail": "Only institution accounts can perform this action."
}
```

Status:

```text
403 Forbidden
```

Unknown user:

```json
{
  "detail": "User not found."
}
```

Status:

```text
404 Not Found
```

---

## GET `/institution/{user_id}`

Example:

```text
GET /institution/3
```

Example response:

```json
{
  "id": 1,
  "user_id": 3,
  "institution_name": "Example Institution",
  "website": "https://example.com",
  "description": "Example institution description"
}
```

Missing institution profile:

```json
{
  "detail": "Institution profile not found."
}
```

---
## GET `/institution/{user_id}/opportunities`

Returns the institution's own opportunities together with aggregated engagement statistics.

Example:

```text
GET /institution/8/opportunities
```

Example response:

```json
[
  {
    "id": 23,
    "title": "Software Engineering Internship",
    "category": "Internship",
    "difficulty": "Intermediate",
    "deadline": "2026-10-30",
    "created_at": "2026-08-22T14:10:02",
    "views": 12,
    "added_to_todo": 4
  }
]
```

Notes:

- `views` and `added_to_todo` count distinct students, not repeat actions;
- only the requesting institution's own opportunities are returned;
- individual student activity is never exposed;
- student user → `403`;
- unknown user → `404`;
- an institution with no opportunities receives `[]` with `200 OK`.

---
# Canonical Shared Values

The following values must stay consistent between:

- frontend dropdowns;
- `seed.sql`;
- `scoring.py`;
- `prompts.py`;
- submission validation.

Do not add or rename values in only one location.

## Majors

Student majors:

```text
Computer and Communications Engineering
Computer Science
Electrical Engineering
Mechanical Engineering
Civil Engineering
Industrial Engineering
Chemical Engineering
Other
```

Opportunities may additionally use:

```text
Any
```

## Opportunity Categories

```text
Internship
Project
Workshop
Bootcamp
Hackathon
Competition
Mentorship
Research
```

## Difficulty Levels

```text
Beginner
Intermediate
Advanced
```

---

# Opportunities API

## GET `/opportunities`

Returns active opportunities ordered by ID.

Optional filters:

```text
category
difficulty
major
```

Examples:

```text
GET /opportunities?difficulty=Beginner
GET /opportunities?category=Internship
GET /opportunities?major=Computer Science
GET /opportunities?category=Internship&difficulty=Advanced
```

When filtering by major, opportunities marked:

```text
Any
```

are also returned.

Expired opportunities are excluded.

Opportunities with no deadline are considered active.

If nothing matches:

```json
[]
```

is returned with `200 OK`.

---

## GET `/opportunities/{opportunity_id}`

Example:

```text
GET /opportunities/1
```

Missing opportunity:

```json
{
  "detail": "Opportunity not found"
}
```

Status:

```text
404 Not Found
```
## POST `/opportunities/{opportunity_id}/view`

Records that a student opened an opportunity's details.

The student's `user_id` is passed as a query parameter and converted to
`students.id` internally.

Example:

```text
POST /opportunities/23/view?user_id=2
```

Response:

```json
{
  "message": "View recorded"
}
```

A view is recorded only when a student opens an opportunity's details, not when
the opportunity simply appears in a list. The frontend should call this endpoint
from the opportunity detail view.

Views feed the aggregated `views` count shown to institutions. Repeat views by
the same student are counted once, because the statistics count distinct students.

Unknown opportunity or missing student profile → `404`.

---
---

# Recommendation Endpoint

```text
GET /student/{user_id}/recommendations
```

The recommendation endpoint:

1. loads the student profile;
2. requires an analyzed level;
3. loads active opportunities;
4. scores each opportunity;
5. adds the match score and reasons;
6. sorts results from highest to lowest.

Missing profile:

```json
{
  "detail": "Student profile not found."
}
```

Status:

```text
404
```

Unanalyzed profile:

```json
{
  "detail": "Student profile must be analyzed before recommendations."
}
```

Status:

```text
400
```

---

# Recommendation Scoring

The scoring function is:

```python
score_opportunity(profile, opportunity)
```

and returns:

```python
(score, reasons)
```

The score ranges from `0` to `100`.

Current weights:

| Factor | Points | Partial credit |
|---|---:|---|
| Major | 20 | 10 when opportunity major is `Any` |
| Difficulty | 15 | 7 when one level apart |
| Skills | 20 | 5 per matching skill, max 4 |
| Interests | 10 | — |
| Preferred opportunity type | 5 | — |
| Suitable year | 10 | 5 when one year apart or unspecified |
| Time compatibility | 10 | 5 when hours exceed availability by no more than 5 |
| Career goal | 10 | — |
| **Total** | **100** | |

Self-paced opportunities with:

```text
hours_per_week = NULL
deadline = NULL
```

are supported.

Missing values are handled safely by the scoring logic.

Expired opportunities are excluded.

Unit tests are located in:

```text
backend/test_scoring.py
```

---

# AI Integration Layer

File:

```text
backend/prompts.py
```

The AI reasoning layer provides:

- opportunity extraction prompts;
- roadmap prompts;
- strict output contracts;
- JSON parsing;
- validation;
- rule-based roadmap fallback.

AI output is never trusted directly.

## Opportunity extraction

```python
build_extraction_prompt(description)
```

creates the extraction prompt.

```python
extract_opportunity(raw_ai_response)
```

parses and validates the model output.

Validation rejects:

- invalid JSON;
- missing required fields;
- unexpected fields;
- invalid categories;
- invalid difficulty values;
- invalid majors;
- incorrect types.

Markdown JSON fences are tolerated and removed.

## Roadmap generation

```python
build_roadmap_prompt(profile, recommendations)
```

creates the roadmap prompt.

```python
generate_roadmap(raw_ai_response)
```

parses and validates an AI roadmap.

A valid roadmap contains:

```text
summary
milestones
recommended_next_steps
```

## Rule-based fallback

```python
fallback_roadmap(profile, recommendations)
```

requires no AI connection.

It builds a roadmap using:

- student level;
- current student skills;
- missing skills;
- top recommendations.

It returns:

```json
{
  "source": "fallback"
}
```

together with the roadmap content.

This function is used when the AI call fails, times out, returns invalid JSON, or is unavailable.

## AI testing status

The prompt and scoring test suites are implemented in:

```text
backend/test_prompts.py
backend/test_scoring.py
```

The AI integration has also been tested against a live Gemini API response.

Verified live behavior includes:

- opportunity descriptions successfully producing structured drafts;
- roadmap generation returning validated AI output;
- `"source": "ai"` when Gemini succeeds;
- `"source": "fallback"` when the API key is unavailable;
- AI failure paths returning usable output instead of a `500`.

Run the existing prompt/scoring tests with:

```bash
python -m pytest test_scoring.py test_prompts.py -v
```
## Profile Image Paths

`institutions.logo_url` and `students.profile_picture_url` store a
**relative** path to an uploaded file, for example:

```text
/uploads/logos/3.png
/uploads/profile-pictures/7.jpg
```

Absolute URLs are not stored, so links keep working after deployment.
The frontend prepends its configured API base URL.

---

# Feature 4 Issue #38 — Opportunity Submission

## POST `/institution/opportunities/process`

Processes a pasted opportunity description with Gemini and returns a draft.

It **never saves the result**.

Flow:

```text
raw opportunity description
        ↓
institution authorization
        ↓
build_extraction_prompt()
        ↓
ai_client.call_ai()
        ↓
extract_opportunity()
        ↓
validated editable draft
```

Example request:

```json
{
  "user_id": 3,
  "description": "Software Engineering Internship for Computer Science students. Requires Python and SQL. Intermediate difficulty. 10 hours per week for 3 months."
}
```

Example AI response:

```json
{
  "draft": {
    "title": "Software Engineering Internship",
    "category": "Internship",
    "difficulty": "Intermediate",
    "suitable_major": "Computer Science",
    "suitable_year": null,
    "required_skills": [
      "Python",
      "SQL"
    ],
    "skills_gained": [],
    "hours_per_week": 10,
    "estimated_time": "3 months",
    "cv_benefit": null,
    "link": null,
    "deadline": null
  }
}
```

If Gemini is unavailable, the endpoint still returns `200`:

```json
{
  "draft": {
    "title": "Software Engineering Internship requiring Python and SQL.",
    "category": null,
    "difficulty": null,
    "suitable_major": null,
    "suitable_year": null,
    "required_skills": [],
    "skills_gained": [],
    "hours_per_week": null,
    "estimated_time": null,
    "cv_benefit": null,
    "link": null,
    "deadline": null
  },
  "warning": "AI processing was unavailable. Please review and complete the draft manually."
}
```

Student user:

```json
{
  "detail": "Only institution accounts can perform this action."
}
```

Status:

```text
403
```

Unknown user:

```json
{
  "detail": "User not found."
}
```

Status:

```text
404
```

---

## POST `/institution/opportunities`

Saves the institution's reviewed/edited opportunity.

The backend:

1. verifies the user is an institution;
2. finds the related institution profile;
3. saves the opportunity;
4. sets `institution_id`;
5. sets `source = "institution"`.

The institution does not supply `institution_id` or `source`.

Example request:

```json
{
  "user_id": 3,
  "title": "Software Engineering Internship",
  "category": "Internship",
  "difficulty": "Intermediate",
  "suitable_major": "Computer Science",
  "suitable_year": null,
  "required_skills": [
    "Python",
    "SQL"
  ],
  "skills_gained": [
    "Backend Development",
    "Teamwork"
  ],
  "hours_per_week": 10,
  "estimated_time": "3 months",
  "cv_benefit": "Provides practical software engineering experience",
  "link": "https://example.com/internship",
  "deadline": "2026-10-30"
}
```

Response:

```json
{
  "message": "Opportunity submitted successfully",
  "opportunity_id": 6,
  "institution_id": 1,
  "source": "institution"
}
```

The request schema validates the canonical values for:

```text
category
difficulty
suitable_major
```

Invalid values are rejected with:

```text
422 Unprocessable Entity
```

---

# Feature 4 Issue #38 — Student Roadmaps

## POST `/student/{user_id}/roadmap`

Generates or regenerates a roadmap.

No request body is required.

The endpoint:

1. loads the saved student profile;
2. checks that the profile has been analyzed;
3. loads active opportunities;
4. scores them using `score_opportunity()`;
5. creates the roadmap prompt;
6. calls Gemini;
7. validates the result;
8. falls back to `fallback_roadmap()` if AI fails;
9. saves the roadmap into the `roadmaps` table.

Calling POST again regenerates and replaces the previous cached roadmap.

Example:

```text
POST /student/1/roadmap
```

Example AI response:

```json
{
  "user_id": 1,
  "source": "ai",
  "roadmap": {
    "summary": "Focus on strengthening backend development skills and closing the gaps required by your strongest opportunity matches.",
    "milestones": [
      {
        "title": "Strengthen version control skills",
        "description": "Practice Git workflows used in collaborative software projects.",
        "skills_to_learn": [
          "Git"
        ],
        "suggested_timeframe": "2-3 weeks"
      }
    ],
    "recommended_next_steps": [
      "Apply to your strongest matching opportunities"
    ]
  }
}
```

## AI-unavailable roadmap behavior

If Gemini is unavailable or the API key is removed, the endpoint still returns:

```text
200 OK
```

and uses:

```json
{
  "source": "fallback"
}
```

Example:

```json
{
  "user_id": 1,
  "source": "fallback",
  "roadmap": {
    "summary": "A rules-based roadmap for a Beginner student, focused on closing skill gaps and preparing for top matched opportunities.",
    "milestones": [
      {
        "title": "Strengthen your beginner foundations",
        "description": "Review core concepts and close the most common skill gaps before applying to your top-matched opportunities.",
        "skills_to_learn": [
          "Git"
        ],
        "suggested_timeframe": "2-4 weeks"
      }
    ],
    "recommended_next_steps": [
      "Learn Git"
    ]
  }
}
```

---

## GET `/student/{user_id}/roadmap`

Returns the currently cached roadmap.

This endpoint **does not call Gemini**.

Example:

```text
GET /student/1/roadmap
```

Example response:

```json
{
  "user_id": 1,
  "source": "ai",
  "generated_at": "2026-08-14T10:24:04",
  "roadmap": {
    "summary": "Focus on strengthening backend development skills.",
    "milestones": [
      {
        "title": "Strengthen version control skills",
        "description": "Practice Git workflows.",
        "skills_to_learn": [
          "Git"
        ],
        "suggested_timeframe": "2-3 weeks"
      }
    ],
    "recommended_next_steps": [
      "Apply to your strongest matching opportunities"
    ]
  }
}
```

If no cached roadmap exists:

```json
{
  "detail": "Roadmap not found."
}
```

Status:

```text
404
```

---

# Roadmap Caching

The `roadmaps.user_id` column is unique, so one cached roadmap is stored per student.

The cached roadmap remains until:

1. the student explicitly regenerates it through:

```text
POST /student/{user_id}/roadmap
```

or:

2. the student profile is updated through:

```text
POST /student-profile
```

Updating the profile deletes the existing roadmap cache.

There is no automatic timer-based regeneration.

---

# Opportunity and Roadmap Sources

`opportunities.source`:

```text
seed
institution
```

- `seed` → curated opportunities loaded through the seed file;
- `institution` → opportunities submitted through an institution account.

`roadmaps.source`:

```text
ai
fallback
```

- `ai` → generated successfully by Gemini;
- `fallback` → generated using the local rule-based fallback.

---

# Shared Gemini Client

File:

```text
backend/ai_client.py
```

The client:

- reads `GEMINI_API_KEY` from `.env`;
- uses the Google GenAI Python SDK;
- applies a request timeout;
- performs the initial attempt plus one retry;
- raises an exception after both attempts fail.

The API endpoints catch AI failures and provide fallback behavior instead of allowing AI problems to cause an unhandled `500`.

---

# Feature 4 Database Migration

For an existing local Skill+ database, run:

```bash
psql -U postgres -d skillplus -f backend/schema.sql
```

and:

```bash
psql -U postgres -d skillplus -c "ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);"
```

and:

```bash
psql -U postgres -d skillplus -c "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);"
```

Because:

```sql
CREATE TABLE IF NOT EXISTS opportunities
```

does not alter an already-existing table, existing installations should also run:

```bash
psql -U postgres -d skillplus -c "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS institution_id INTEGER REFERENCES institutions(id);"
```

and:

```bash
psql -U postgres -d skillplus -c "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'seed';"
```

Installations created before the task and analytics work should also run:

```bash
psql -U postgres -d skillplus -c "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
```

The schema creates the `roadmaps`, `student_tasks` and `opportunity_interactions` tables if they do not already exist.

---

# Running the Backend

For password-reset email delivery, place these values in `backend/.env`:

```dotenv
SMTP_EMAIL=your-team-address@gmail.com
SMTP_APP_PASSWORD=your-gmail-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

Use a Gmail App Password, not the account's normal password, and never commit `.env`.

From the `backend` directory:

```bash
python -m uvicorn main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

The Swagger page can be used to test all backend endpoints.

---

# Testing

Prompt/scoring tests:

```bash
python -m pytest test_scoring.py test_prompts.py -v
```

Issue #38 was additionally tested through FastAPI Swagger and a real local PostgreSQL database.

Verified cases include:

- Gemini opportunity extraction → `200`;
- extraction returned structured validated JSON;
- processing endpoint did not save the AI draft;
- institution submission saved with the correct `institution_id`;
- institution submission saved with `source = "institution"`;
- student attempting institution action → `403`;
- unknown institution user → `404`;
- invalid reviewed opportunity enums → `422`;
- Gemini roadmap generation → `source = "ai"`;
- generated roadmap saved in PostgreSQL;
- cached roadmap returned through GET;
- updating the student profile deleted the cached roadmap;
- GET after cache deletion → `404`;
- Gemini key removed → roadmap returned `source = "fallback"` with `200`;
- Gemini key removed → opportunity processing returned an editable fallback draft with `200`.

---

# Current Backend Endpoints

Authentication:

```text
POST /auth/signup
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
```

Students:

```text
POST /student-profile
GET /student/profile/{user_id}
POST /student/analyze/{user_id}
GET /student/{user_id}/recommendations
POST /student/{user_id}/roadmap
GET /student/{user_id}/roadmap
```

Institutions:

```text
POST /institution-profile
GET /institution/{user_id}
POST /institution/opportunities/process
POST /institution/opportunities
GET /institution/{user_id}/opportunities
GET /institution/{user_id}/opportunities/all
```

Opportunities:

```text
GET /opportunities
GET /opportunities/{opportunity_id}
POST /opportunities/{opportunity_id}/view
```
