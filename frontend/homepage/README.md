# Skill+ Frontend — Member 5 Profile Flow

## Task

Build the frontend pages and test the complete Feature 1 flow:

`Sign up -> Log in -> Fill profile -> Submit -> See analysis result`

## Pages

- `/signup`: Creates a student account using `POST /auth/signup`.
- `/login`: Logs in using `POST /auth/login` and stores the returned user ID.
- `/profile`: Sends the agreed student profile JSON to `POST /student-profile`.
- `/results`: Displays level, strengths, missing skills and suggested next step from `POST /student/analyze`.

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

Member 4's endpoint currently expects counts. The frontend converts the profile arrays automatically:

```json
{
  "year": 3,
  "courses": 3,
  "skills": 2
}
```

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

The automated flow test verifies all four pages, API paths and exact request payloads.
