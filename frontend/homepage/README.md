# Skill+ Frontend — Member 5 Student Flow

## Task

Build the frontend pages and test the complete Feature 1 and Feature 3 flow:

`Sign up -> Log in -> Fill profile -> See analysis -> View ranked recommendations`

## Pages

- `/signup`: Creates a student account using `POST /auth/signup`.
- `/login`: Logs in using `POST /auth/login` and stores the returned user ID.
- `/forgot-password`: Requests password reset instructions using `POST /auth/forgot-password`.
- `/reset-password?token=...`: Changes the password using `POST /auth/reset-password`.
- `/profile`: Sends the agreed student profile JSON to `POST /student-profile`.
- `/results`: Displays level, strengths, missing skills and suggested next step from `POST /student/analyze/{user_id}`.
- `/recommendations`: Displays ranked opportunity cards from `GET /student/{user_id}/recommendations`.

## Design Feedback Update

The interface uses the exact midnight-blue palette from the team's pinned Figma design:

- Background: `#F8FAFF`
- Text: `#0D1B2A`
- Primary: `#1E3A8A`
- Accent: `#1D4ED8`
- Secondary: `#DBEAFE`
- Muted/input background: `#EFF6FF`

The sign-up name placeholder is anonymous and no team member's personal name appears as sample data.

## Forgot Password Request

```http
POST /auth/forgot-password
Content-Type: application/json
```

```json
{
  "email": "name@mail.aub.edu"
}
```

Expected success response:

```json
{
  "message": "If an account exists, password reset instructions have been sent."
}
```

The request page uses the privacy-safe response returned by the integrated authentication backend. During local development, the backend prints the reset link in its terminal.

## Reset Password Request

The `/reset-password` page reads the token from the reset link and sends:

```http
POST /auth/reset-password
Content-Type: application/json
```

```json
{
  "token": "RESET_TOKEN_FROM_THE_LINK",
  "new_password": "NewPassword456"
}
```

The page validates the token, requires at least 6 password characters, confirms both password fields match, and handles loading, success, invalid-token and expired-token states.

## Student Profile Request

```json
{
  "user_id": 1,
  "major": "CCE",
  "year_of_study": 3,
  "courses_taken": ["Data Structures", "OOP", "Signals"],
  "current_skills": ["Python", "SQL"],
  "interests": ["AI", "Backend Development"],
  "career_goal": "Software Engineer",
  "available_time_per_week": 6,
  "preferred_opportunity_type": "Internship"
}
```

## Analysis Request

After the profile is saved, the frontend calls the integrated user-specific endpoint:

```http
POST /student/analyze/1
```

There is no request body. The backend reads the saved profile's year, courses and skills, performs the analysis and stores the resulting level.

## Analysis Response

```json
{
  "level": "Intermediate",
  "strengths": ["3 course(s) completed", "2 skill(s) acquired"],
  "missing": ["5 more course(s) to reach Advanced"],
  "next_step": "Keep building breadth — a few more courses/skills unlocks Advanced."
}
```

## Recommendations Request

After the analysis results page, the frontend calls the real Feature 3 endpoint:

```http
GET /student/1/recommendations
```

There is no request body. The logged-in user's ID is restored from local storage, including after a browser refresh.

## Recommendations Response

```json
{
  "user_id": 1,
  "recommendations": [
    {
      "id": 8,
      "title": "Backend Development Internship (Local Startup)",
      "category": "Internship",
      "suitable_major": "Computer and Communications Engineering",
      "suitable_year": 2,
      "difficulty": "Intermediate",
      "required_skills": ["Python", "SQL"],
      "skills_gained": ["FastAPI", "REST APIs", "PostgreSQL"],
      "deadline": "2026-12-01",
      "estimated_time": "3 months",
      "cv_benefit": "Real production backend experience.",
      "link": "https://example.com/opportunities/backend-internship",
      "hours_per_week": 15,
      "match_score": 90,
      "reasons": ["Matches your major", "Uses your Python skill"]
    }
  ]
}
```

Each recommendation card displays the title, category, difficulty, deadline, estimated time, weekly time, CV benefit, match score, reasons and application link. The page also handles loading, empty, unavailable-backend and retry states.

## Feature 1 Unhappy Paths

- Duplicate email: shows a clear message and a direct log-in link.
- Empty sign-up/profile form: blocks the request and identifies the missing required fields.
- Refresh: restores the logged-in user and loads recommendations for the same `user_id`.

## Run the Frontend

```bash
npm install
npm run dev
```

The frontend uses `http://localhost:8000` by default. To change it, copy `.env.example` to `.env` and update `VITE_API_URL`.

## Tests

```bash
npm run test:run
npm run build
```

The automated tests verify the complete five-step student flow, the exact recommendations endpoint and response, loading/empty/error/retry behavior, duplicate email, empty forms, refresh persistence, forgot-password requests, reset-password success, missing tokens, expired tokens, API paths and exact request payloads.
