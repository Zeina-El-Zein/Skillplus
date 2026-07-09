# Skill+ Backend — Database Setup

## Requirements
- PostgreSQL 17.10
- psql that comes with PostgreSQL
- Python 3.11+

### Step 1 — Install PostgreSQL

### Step 2 — Create the database
Open your terminal and run:

psql -U postgres

Then inside psql:

CREATE DATABASE skillplus;
\q

### Step 3 — Run the schema file
This creates all the tables automatically:

psql -U postgres -d skillplus -f backend/schema.sql

## Database Tables
users : Stores user accounts for authentication 
students : Stores student profile information
opportunities : Stores available opportunities (pre-populated)

## Sample Data
The opportunities table comes pre-populated with 5 sample opportunities:
- Python Beginner Bootcamp (Beginner)
- Web Dev Hackathon (Intermediate)
- AI Research Internship (Advanced)
- Data Structures Workshop (Beginner)
- Software Engineering Internship (Advanced)

## Notes
- Member 2 (Authentication) depends on the users table
- Member 3 (Profile API) depends on the students table
- Member 4 (Analysis Logic) depends on the students table
---

# Backend Setup

## Environment Variables

Create a `.env` file inside the `backend` folder.

Example:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/skillplus
```

Replace `yourpassword` with your actual PostgreSQL password.

Important: `.env` should not be pushed to GitHub because it contains private database credentials.

---

## Install Python Dependencies

From the `backend` folder, run:

```bash
pip install -r requirements.txt
```

---

## Run the Backend

From the `backend` folder, run:

```bash
python -m uvicorn main:app --reload
```

The backend will run at:

```txt
http://127.0.0.1:8000
```

To check that the backend is running, open:

```txt
http://127.0.0.1:8000
```

Expected response:

```json
{
  "message": "Skill+ backend is running"
}
```

FastAPI documentation is available at:

```txt
http://127.0.0.1:8000/docs
```

---

# Authentication Endpoints

## POST `/auth/signup`

Creates a new student account.

### Request Body

```json
{
  "name": "Test Student",
  "email": "teststudent@example.com",
  "password": "test12345"
}
```

### Success Response

Status code:

```txt
200 OK
```

Response body:

```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "name": "Test Student",
    "email": "teststudent@example.com",
    "role": "student"
  }
}
```

The `id` value may be different depending on the database.

### Duplicate Email Error

If the email is already registered, the endpoint returns:

Status code:

```txt
400 Bad Request
```

Response body:

```json
{
  "detail": "Email already registered"
}
```

### Notes

Passwords are never stored as plaintext. The backend hashes the password using bcrypt before saving it in the `users` table.

---

## POST `/auth/login`

Logs in an existing student account.

### Request Body

```json
{
  "email": "teststudent@example.com",
  "password": "test12345"
}
```

### Success Response

Status code:

```txt
200 OK
```

Response body:

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "name": "Test Student",
    "email": "teststudent@example.com",
    "role": "student"
  }
}
```

### Invalid Login Error

If the email does not exist or the password is incorrect, the endpoint returns:

Status code:

```txt
401 Unauthorized
```

Response body:

```json
{
  "detail": "Invalid email or password"
}
```

The error message is intentionally generic so that the backend does not reveal whether the email or password was wrong.

---

# Manual Testing Completed

The following cases were tested manually using FastAPI `/docs`:

- Valid signup creates a new user successfully.
- Duplicate signup returns a clear error message.
- Valid login returns a success response.
- Login with wrong password returns a generic error.
- Login with a non-existing email returns the same generic error.
- Password is stored in the database as a bcrypt hash, not plaintext.

---

# Current Implemented Routes

```txt
GET  /
POST /auth/signup
POST /auth/login
```