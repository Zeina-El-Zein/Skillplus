# Skill+ Backend — Database Setup

## Requirements

- PostgreSQL 17.10
- psql that comes with PostgreSQL
- Python 3.11+

### Step 1 — Install PostgreSQL

Install PostgreSQL on your computer.

### Step 2 — Create the database

Open your terminal and run:

```bash
psql -U postgres
```

Then, inside psql, run:

```sql
CREATE DATABASE skillplus;
\q
```

### Step 3 — Run the schema file

This creates all the required tables automatically.

From the main project folder, run:

```bash
psql -U postgres -d skillplus -f backend/schema.sql
```

### Step 4 — Load the sample opportunities

```bash
psql -U postgres -d skillplus -f backend/seed.sql
```

This loads 22 sample opportunities. It is safe to re-run — it clears and reloads the opportunities table without touching users or students.

### Step 5 — Create the .env file

Create a file named `.env` inside the `backend/` folder with the following values:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/skillplus
FRONTEND_URL=http://localhost:5173  ```

Replace YOUR_PASSWORD with your local PostgreSQL password.
Never commit this file — it is listed in .gitignore.

### Step 6 — Install dependencies

pip install -r requirements.txt

## Database Tables

- `users`: Stores user accounts for authentication.
- `students`: Stores student profile information.
- `opportunities`: Stores available opportunities.
- `password_reset_tokens`: Stores hashed, temporary, one-time password reset tokens.
- `institutions`: Stores institution profile information linked to institution user accounts.

## Sample Data

The `opportunities` table is populated by `seed.sql` with 22 opportunities:
8 Beginner, 8 Intermediate, 6 Advanced, covering all majors in the
contracts list plus opportunities marked `Any`.

## Notes

- Member 2, who is working on authentication, depends on the `users` table.
- Member 3, who is working on the Profile API, depends on the `students` table.
- Member 4, who is working on the analysis logic, depends on the `students` table.

## Authentication API Endpoints

The backend provides four authentication endpoints:

- `POST /auth/signup` creates a new user account.
- `POST /auth/login` authenticates an existing user.
- `POST /auth/forgot-password` creates a temporary password reset token.
- `POST /auth/reset-password` changes the user's password using a valid reset token.

### POST /auth/signup

Creates a new user account.

Example request:

```json
{
  "name": "Firas Test",
  "email": "firas.test@example.com",
  "password": "OldPassword123",
  "role": "student"
}
```
The role must be either `student` or `institution`. Any other value, or a missing role, is rejected.

Example successful response:

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

If the email is already registered, the endpoint returns:

```json
{
  "detail": "Email already registered"
}
```

### POST /auth/login

Authenticates a user using their email and password.

Example request:

```json
{
  "email": "firas.test@example.com",
  "password": "OldPassword123"
}
```

Example successful response:

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

If the email or password is incorrect, the endpoint returns:

```json
{
  "detail": "Invalid email or password"
}
```

### POST /auth/forgot-password

Creates a secure password reset token for the account associated with the submitted email.

Example request:

```json
{
  "email": "firas.test@example.com"
}
```

Example response:

```json
{
  "message": "If an account exists, password reset instructions have been sent."
}
```

For security, the backend returns the same message whether the submitted email exists or not. This prevents users from discovering which email addresses have registered accounts.

During local development, the password reset link is printed in the backend terminal:

```text
http://localhost:5173/reset-password?token=RESET_TOKEN
```

The reset token:

- Expires after 30 minutes.
- Can only be used once.
- Is invalidated when a newer token is created.
- Is hashed before being stored in the database.

> The reset link is printed only for local development. Before deployment, it should be sent through an email service instead.

### POST /auth/reset-password

Changes the user's password using the token received in the password reset link.

Example request:

```json
{
  "token": "RESET_TOKEN_FROM_THE_LINK",
  "new_password": "NewPassword456"
}
```

Example successful response:

```json
{
  "message": "Password reset successfully."
}
```

If the token is invalid, expired, or already used, the endpoint returns:

```json
{
  "detail": "Invalid or expired password reset token."
}
```

After a successful password reset:

- The old password no longer works.
- The new password can be used to log in.
- The reset token cannot be reused.

### Password Reset Security

The password reset implementation includes:

- Secure random token generation.
- SHA-256 hashing before storing reset tokens.
- bcrypt hashing for user passwords.
- A 30-minute expiration time.
- One-time token use.
- Invalidation of older active tokens.
- A general response that does not reveal whether an email exists.

The raw reset token is not stored in the database.

## Student Profile API Endpoints

The backend provides three endpoints for student profiles:

- `POST /student-profile` saves or updates a student profile (one profile per user).
- `GET /student/profile/{user_id}` retrieves an existing student profile.
- `POST /student/analyze/{user_id}` analyzes the profile and saves the level.

### POST /student-profile

This endpoint saves student information in the `students` table.

The `user_id` must belong to an existing user created using the signup endpoint.

Example request:

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

Example successful response:

```json
{
  "message": "Student profile saved successfully",
  "student_id": 4
}
```

If the `user_id` does not exist, the endpoint returns:

```json
{
  "detail": "User not found. Please use an existing user_id."
}
```

### GET /student/profile/{user_id}

This endpoint retrieves the saved student profile for a specific user.

The value written after `/student/profile/` is the user ID.

Example request:

```text
GET /student/profile/2
```

Example successful response:

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

If no profile exists for the given user, the endpoint returns:

```json
{
  "detail": "Student profile not found."
}
```
Note: `level` is `null` until the profile has been analyzed at least
once with `POST /student/analyze/{user_id}`.
### POST /student/analyze/{user_id}

Analyzes the saved profile using the classification rules, saves the
resulting level in the students table, and returns it with details.

Example request:

    POST /student/analyze/2

Example successful response:

    {
      "user_id": 2,
      "level": "Beginner",
      "strengths": ["2 course(s) completed", "2 skill(s) acquired"],
      "missing": ["3 more course(s) to reach Intermediate",
                  "1 more skill(s) to reach Intermediate"],
      "next_step": "Focus on foundational courses and building your first skills."
    }

If no profile exists for the given user, it returns:

    {"detail": "Student profile not found."}

Classification rules (first match wins, any year of study):
- 8+ courses AND 6+ skills → Advanced
- 5+ courses OR 4+ skills → Intermediate
- fewer than 5 courses AND fewer than 3 skills → Beginner
- otherwise → Intermediate

## Running the Backend

Open a terminal inside the `backend` folder and run:

```bash
python -m uvicorn main:app --reload
```

The backend will run at:

```text
http://127.0.0.1:8000
```

Open the FastAPI documentation at:

```text
http://127.0.0.1:8000/docs
```

The documentation page can be used to test:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /student-profile`
- `GET /student/profile/{user_id}`
- `POST /student/analyze/{user_id}`
- `POST /institution-profile`
- `GET /institution/{user_id}`

## Institution Accounts


Skill+ supports two user roles:

* `student`
* `institution`

When creating a new account through `POST /auth/signup`, the role must be explicitly provided.

Example institution signup:

```json
{
  "name": "Example Institution",
  "email": "institution@example.com",
  "password": "Password123",
  "role": "institution"
}
```

Only `student` and `institution` are accepted as roles.

### POST /institution-profile

Creates or updates an institution profile.

Only users whose role is `institution` can use this endpoint.

Example request:

```json
{
  "user_id": 1,
  "institution_name": "Example Institution",
  "website": "https://example.com",
  "description": "Example institution description"
}
```

Example successful response:

```json
{
  "message": "Institution profile saved successfully",
  "institution_id": 1
}
```

If the user exists but is not an institution, the endpoint returns:

```json
{
  "detail": "Only institution accounts can perform this action."
}
```

with status code `403 Forbidden`.

If the user does not exist, the endpoint returns:

```json
{
  "detail": "User not found."
}
```

with status code `404 Not Found`.

If a profile already exists for the same `user_id`, the existing institution profile is updated instead of creating a duplicate.

### GET /institution/{user_id}

Retrieves the institution profile associated with the specified user ID.

Example request:

```text
GET /institution/1
```

Example successful response:

```json
{
  "id": 1,
  "user_id": 1,
  "institution_name": "Example Institution",
  "website": "https://example.com",
  "description": "Example institution description"
}
```

If no institution profile exists for the specified user, the endpoint returns:

```json
{
  "detail": "Institution profile not found."
}
```

with status code `404 Not Found`.

### Institution Authorization

Institution-only backend actions use the reusable `require_institution()` authorization check.

The check verifies that the supplied user exists and has the `institution` role.

* A nonexistent user is rejected with `404 Not Found`.
* A user whose role is not `institution` is rejected with `403 Forbidden`.
* An institution account is allowed to continue with the requested institution-only action.


## Shared value lists (contracts)

These values must be identical in the profile form dropdown, seed.sql,
and the scoring logic. Do not add or rename values without telling the team.

**Major** (students.major and opportunities.suitable_major):
- Computer and Communications Engineering
- Computer Science
- Electrical Engineering
- Mechanical Engineering
- Civil Engineering
- Industrial Engineering
- Chemical Engineering
- Other

Opportunities may also use `Any` for suitable_major, meaning it suits every major.

**Opportunity type / category** (students.preferred_opportunity_type and opportunities.category):
Internship, Project, Workshop, Bootcamp, Hackathon, Competition, Mentorship, Research

**Difficulty / level** (opportunities.difficulty and students.level):
Beginner, Intermediate, Advanced


## Schema changes

If you already had the database before Feature 2, add the new column:

```bash
psql -U postgres -d skillplus -c "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS hours_per_week INTEGER;"
```

If your local database was created before institution accounts were added, run:

```bash
psql -U postgres -d skillplus -f backend/schema.sql
```
This creates the institutions table if it does not already exist. The database does not need to be recreated.

## Opportunities API

The Opportunities API provides read-only access to the opportunities stored in the database.

### Get all opportunities

```http
GET /opportunities
```

Returns all opportunities ordered by ID.

Optional query parameters:

- `category`
- `difficulty`
- `major`

Examples:

```http
GET /opportunities?difficulty=Beginner
GET /opportunities?category=Internship
GET /opportunities?major=Computer Science
GET /opportunities?category=Internship&difficulty=Advanced
```

When filtering by major, opportunities whose `suitable_major` is `Any` are also returned.

Example request:

```http
GET /opportunities?difficulty=Beginner
```

Example response:

```json
[
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
    "cv_benefit": "First programming credential",
    "link": "https://example.com/opportunities/python-bootcamp",
    "hours_per_week": 6
  }
]
```

If no opportunities match the supplied filters, the endpoint returns an empty list:

```json
[]
```

This is returned with status code `200 OK`.

### Get an opportunity by ID

```http
GET /opportunities/{opportunity_id}
```

Example:

```http
GET /opportunities/1
```

Returns the opportunity whose ID matches `opportunity_id`.

If the ID is a valid integer but the opportunity does not exist, the endpoint returns:

```json
{
  "detail": "Opportunity not found"
}
```

with status code:

```text
404 Not Found
```

If the supplied ID is not an integer, FastAPI automatically returns a validation error with status code `422`.

Expired opportunities are excluded from the public API. Opportunities with a deadline equal to or later than the current date, or with no deadline, are returned.


## Opportunity Scoring

The recommendation engine ranks opportunities based on how well they match a student's profile.

The scoring logic is implemented in:

```
backend/scoring.py
```

### Main Function

```python
score_opportunity(profile, opportunity)
```

Returns:

```python
(score, reasons)
```

where:

- `score` is an integer between **0 and 100**
- `reasons` is a list of strings explaining why the opportunity matches the student's profile

Example:

```python
score, reasons = score_opportunity(profile, opportunity)

print(score)
# 90

print(reasons)
# [
#     "Matches your major",
#     "Suitable for your experience level",
#     "Uses your Python skill",
#     "Matches your preferred opportunity type"
# ]
```

---

### Scoring Weights

| Criterion | Points |
|-----------|-------:|
| Exact major match | 30 |
| Opportunity major = `Any` | 15 |
| Exact difficulty match | 25 |
| One-level difficulty difference | 10 |
| Matching required skills | 5 points per skill (maximum 20) |
| Matching interest | 15 |
| Preferred opportunity type | 10 |

Maximum possible score:

```
100 points
```

---

### Difficulty Matching

Difficulty levels are:

- Beginner
- Intermediate
- Advanced

Scoring:

| Difference | Points |
|------------|-------:|
| Exact match | 25 |
| One level apart | 10 |
| Two levels apart | 0 |

---

### Skill Matching

Each shared required skill contributes **5 points**.

A maximum of **4 matching skills** are counted, for a maximum of **20 points**.

---

### Active Opportunities

Expired opportunities are excluded before scoring.

Use:

```python
filter_active_opportunities(opportunities)
```

Rules:

- Deadline before today → expired
- Deadline equal to today → active
- No deadline (`None`) → active

---

### Missing Data

The scoring functions safely handle missing or `None` values.

Missing fields simply contribute zero points and do not raise exceptions.

---

### Unit Tests

Scoring is tested in:

```
backend/test_scoring.py
```

The tests cover:

- Perfect match
- Zero match
- Level mismatch
- Missing or `None` fields
- Missing keys
- Skill score cap
- Expired opportunity filtering
- Opportunities with no deadline