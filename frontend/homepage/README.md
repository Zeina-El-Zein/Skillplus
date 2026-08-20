# Skill+ Frontend — Member 5 Role-Aware Flows

## Task

Build and test both complete frontend journeys:

~~~text
Student:
Sign up -> Fill profile -> See analysis -> View ranked recommendations -> Roadmap

Institution:
Sign up -> Institution dashboard/profile -> Paste description -> Edit draft -> Publish
~~~

## Pages

- `/signup`: Creates a `student` or `institution` account using `POST /auth/signup`.
- `/login`: Stores the returned user and redirects by role.
- `/forgot-password`: Requests password reset instructions using `POST /auth/forgot-password`.
- `/reset-password?token=...`: Changes the password using `POST /auth/reset-password`.
- `/profile`: Loads an existing profile when needed, sends the agreed JSON to `POST /student-profile`, and optionally uploads a profile picture.
- `/results`: Displays level, strengths, missing skills and suggested next step from `POST /student/analyze/{user_id}`.
- `/recommendations`: Displays ranked opportunity cards from `GET /student/{user_id}/recommendations`.
- `/roadmap`: Loads the cached roadmap with `GET /student/{user_id}/roadmap` and generates/regenerates it with `POST /student/{user_id}/roadmap`.
- `/institution/dashboard`: Loads or creates the institution profile and optionally uploads its logo.
- `/institution/opportunities/new`: Sends a pasted description to `POST /institution/opportunities/process`.
- `/institution/opportunities/review`: Shows every extracted field as editable and publishes only the reviewed version through `POST /institution/opportunities`.

## Role-Aware Authentication

Signup sends the backend-required role:

~~~json
{
  "name": "Example User",
  "email": "name@mail.aub.edu",
  "password": "password123",
  "role": "institution"
}
~~~

Signup stores the returned user and redirects immediately. Login uses the backend `has_profile` field:

- new student or student without a profile → `/profile`
- returning student with a profile → `/recommendations`
- `institution` → `/institution/dashboard`

Student-only pages redirect institution users to the institution dashboard. Institution-only pages redirect student users to the student profile flow.

The local demo session has a rolling 14-day expiry. Expired or malformed sessions are cleared before protected content is shown.

## Image Uploads

Student profile pictures use `POST /student/{user_id}/profile-picture`; institution logos use `POST /institution/{user_id}/logo`. Both requests use multipart form data with the field name `file`.

The shared picker accepts JPG, PNG and WEBP images up to 5 MB, previews a valid selection, never sets a manual multipart `Content-Type` boundary, and resolves the backend's relative `/uploads/...` response against `VITE_API_URL`.

## Institution Opportunity Flow

The institution dashboard loads `GET /institution/{user_id}`. If the profile does not exist, it creates one through `POST /institution-profile`.

The submission page sends `{ user_id, description }` to `POST /institution/opportunities/process`. That endpoint never saves. Its draft is stored locally so the review page survives a refresh.

The review page uses the backend's exact category, difficulty and major values, validates optional numbers and links, and sends the final reviewed fields to `POST /institution/opportunities`.

When AI extraction is unavailable, the backend returns an editable fallback draft and warning. The frontend labels this state `Generated offline` and requires the institution to complete the missing canonical fields.

## Student Roadmap

The roadmap page first requests the cached roadmap. A `404` becomes a clear empty state rather than an error. Generate/regenerate sends a bodyless `POST` request.

The page displays the summary, ordered milestones, skills to learn, suggested timeframes, recommended next steps, cached generation time, and the honest source label: `AI-assisted roadmap` or `Generated offline`.

Loading, missing, backend-error, retry and fallback states are all implemented. Generation uses an animated profile-to-plan sequence, and saved results reveal progressively. All added motion is disabled when the operating system requests reduced motion.

## Honest Homepage Claims

Unsupported claims such as `2,400+ students matched`, `95% fit accuracy`, and matching against `thousands` of opportunities were removed. The homepage now distinguishes transparent rule-based analysis/scoring from the two real AI-assisted features: opportunity extraction and roadmap generation.

The non-functional Privacy and Terms placeholders were removed. The contact footer now opens a real message to `skillplus.teamm@gmail.com`.

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

The automated tests verify both complete role flows; exact role, institution, draft, publish and roadmap requests; editable AI fallback behavior; roadmap cache/generation/errors/retries; role guards; corrected homepage claims; and all earlier recommendation, validation, refresh and password-reset behavior.
