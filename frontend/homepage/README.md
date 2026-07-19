# Skill+ Frontend — Member 5 Profile Flow

## Task

Build the frontend pages and test the complete Feature 1 flow:

`Sign up -> Log in -> Fill profile -> Submit -> See analysis result`

## Pages

- `/signup`: Creates a student account using `POST /auth/signup`.
- `/login`: Logs in using `POST /auth/login` and stores the returned user ID.
- `/forgot-password`: Requests password reset instructions using `POST /auth/forgot-password`.
- `/profile`: Sends the agreed student profile JSON to `POST /student-profile`.
- `/results`: Displays level, strengths, missing skills and suggested next step from `POST /student/analyze/{user_id}`.

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

The frontend route, validation, loading, error and success states are complete. Member 2's authentication backend still needs to implement this endpoint and its secure email/token reset process before real reset emails can be sent.

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

The automated tests verify the complete four-step student flow, the forgot-password page, API paths and exact request payloads.
