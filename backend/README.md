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

### Step 4 — Create the .env file

Create a file named `.env` inside the `backend/` folder with the following values:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/skillplus
FRONTEND_URL=http://localhost:5173

Replace YOUR_PASSWORD with your local PostgreSQL password.
Never commit this file — it is listed in .gitignore.

### Step 5 — Install dependencies

pip install -r requirements.txt

## Database Tables

- `users`: Stores user accounts for authentication.
- `students`: Stores student profile information.
- `opportunities`: Stores available opportunities.
- `password_reset_tokens`: Stores hashed, temporary, one-time password reset tokens.

## Sample Data

The `opportunities` table comes pre-populated with five sample opportunities:

- Python Beginner Bootcamp — Beginner
- Web Dev Hackathon — Intermediate
- AI Research Internship — Advanced
- Data Structures Workshop — Beginner
- Software Engineering Internship — Advanced

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
  "password": "OldPassword123"
}
```

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