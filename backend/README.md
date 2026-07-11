# Skill+ Backend — Database Setup

## Requirements

- PostgreSQL 17.10
- psql that comes with PostgreSQL

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

## Database Tables

- `users`: Stores user accounts for authentication.
- `students`: Stores student profile information.
- `opportunities`: Stores available opportunities.

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

## Student Profile API Endpoints

The backend provides two endpoints for student profiles:

- `POST /student-profile` saves a new student profile.
- `GET /student/profile/{user_id}` retrieves an existing student profile.

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
  "preferred_opportunity_type": "Internship"
}
```

If no profile exists for the given user, the endpoint returns:

```json
{
  "detail": "Student profile not found."
}
```

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
- `POST /student-profile`
- `GET /student/profile/{user_id}`