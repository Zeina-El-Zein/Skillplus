import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const user = {
  id: 1,
  name: "Alex Morgan",
  email: "alex.morgan@mail.aub.edu",
  role: "student",
};

const institutionUser = {
  id: 3,
  name: "AUB Career Office",
  email: "careers@mail.aub.edu",
  role: "institution",
};

const recommendations = [
  {
    id: 8,
    title: "Backend Development Internship",
    category: "Internship",
    suitable_major: "Computer and Communications Engineering",
    suitable_year: 2,
    difficulty: "Intermediate",
    required_skills: ["Python", "SQL"],
    skills_gained: ["FastAPI", "PostgreSQL"],
    deadline: "2026-12-01",
    estimated_time: "3 months",
    cv_benefit: "Real production backend experience.",
    link: "https://example.com/apply/backend",
    hours_per_week: 15,
    match_score: 90,
    reasons: ["Matches your major", "Uses your Python skill"],
  },
  {
    id: 1,
    title: "Python for Engineers Bootcamp",
    category: "Bootcamp",
    suitable_major: "Any",
    suitable_year: 1,
    difficulty: "Beginner",
    required_skills: [],
    skills_gained: ["Python"],
    deadline: null,
    estimated_time: "6 weeks",
    cv_benefit: "A first programming credential.",
    link: "https://example.com/apply/python",
    hours_per_week: 6,
    match_score: 50,
    reasons: ["Open to all majors"],
  },
];

function storeUser() {
  window.localStorage.setItem("skillplus_user", JSON.stringify(user));
}

function storeInstitutionUser() {
  window.localStorage.setItem("skillplus_user", JSON.stringify(institutionUser));
}

describe("Member 5 complete student flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/signup");
  });

  it("completes signup, login, profile analysis and ranked recommendations", async () => {
    const requests: Array<{ path: string; method: string; body: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        requests.push({ path: url.pathname, method: init?.method || "GET", body });

        if (url.pathname === "/auth/signup") {
          return Response.json({ message: "User created successfully", user });
        }

        if (url.pathname === "/auth/login") {
          return Response.json({ message: "Login successful", user });
        }

        if (url.pathname === "/student-profile") {
          return Response.json({ message: "Student profile saved successfully", student_id: 4 });
        }

        if (url.pathname === "/student/analyze/1") {
          return Response.json({
            level: "Intermediate",
            strengths: ["3 course(s) completed", "2 skill(s) acquired"],
            missing: ["5 more course(s) to reach Advanced", "4 more skill(s) to reach Advanced"],
            next_step: "Keep building breadth — a few more courses/skills unlocks Advanced.",
          });
        }

        if (url.pathname === "/student/1/recommendations") {
          return Response.json({ user_id: 1, recommendations });
        }

        return Response.json({ detail: "Not found" }, { status: 404 });
      }),
    );

    const browser = userEvent.setup();
    render(<App />);

    await browser.type(screen.getByLabelText(/Full name/i), user.name);
    await browser.type(screen.getByLabelText(/Email address/i), user.email);
    await browser.type(screen.getByLabelText(/^Password$/i), "password123");
    await browser.type(screen.getByLabelText(/Confirm password/i), "password123");
    await browser.click(screen.getByRole("button", { name: /Create account/i }));

    expect(await screen.findByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
    await browser.type(screen.getByLabelText(/Password/i), "password123");
    await browser.click(screen.getByRole("button", { name: /Log in/i }));

    expect(await screen.findByRole("heading", { name: /Build your student profile/i })).toBeInTheDocument();
    await browser.selectOptions(
      screen.getByLabelText(/Major/i),
      "Computer and Communications Engineering",
    );
    await browser.selectOptions(screen.getByLabelText(/Year of study/i), "3");
    await browser.type(screen.getByLabelText(/Courses taken/i), "Data Structures, OOP, Signals");
    await browser.type(screen.getByLabelText(/Current skills/i), "Python, SQL");
    await browser.type(screen.getByLabelText(/Interests/i), "AI, Backend Development");
    await browser.type(screen.getByLabelText(/Career goal/i), "Software Engineer");
    await browser.type(screen.getByLabelText(/Available hours per week/i), "6");
    await browser.selectOptions(screen.getByLabelText(/Preferred opportunity type/i), "Internship");
    await browser.click(screen.getByRole("button", { name: /Save and analyze profile/i }));

    expect(await screen.findByRole("heading", { name: /Your analysis is ready/i })).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
    await browser.click(screen.getByRole("button", { name: /View matched opportunities/i }));

    expect(
      await screen.findByRole("heading", { name: /Your matched opportunities/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backend Development Internship" })).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("Uses your Python skill")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Apply for this opportunity/i })[0],
    ).toHaveAttribute("href", "https://example.com/apply/backend");

    await waitFor(() => expect(requests).toHaveLength(5));
    expect(requests.map((request) => request.path)).toEqual([
      "/auth/signup",
      "/auth/login",
      "/student-profile",
      "/student/analyze/1",
      "/student/1/recommendations",
    ]);
    expect(requests[0].body).toEqual({
      name: user.name,
      email: user.email,
      password: "password123",
      role: "student",
    });
    expect(requests[2].body).toEqual({
      user_id: 1,
      major: "Computer and Communications Engineering",
      year_of_study: 3,
      courses_taken: ["Data Structures", "OOP", "Signals"],
      current_skills: ["Python", "SQL"],
      interests: ["AI", "Backend Development"],
      career_goal: "Software Engineer",
      available_time_per_week: 6,
      preferred_opportunity_type: "Internship",
    });
    expect(requests[3]).toMatchObject({ method: "POST", body: null });
    expect(requests[4]).toEqual({
      path: "/student/1/recommendations",
      method: "GET",
      body: null,
    });
  });

  it("shows a useful duplicate-email error and login path", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ detail: "Email already registered" }, { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const browser = userEvent.setup();
    render(<App />);

    await browser.type(screen.getByLabelText(/Full name/i), user.name);
    await browser.type(screen.getByLabelText(/Email address/i), user.email);
    await browser.type(screen.getByLabelText(/^Password$/i), "password123");
    await browser.type(screen.getByLabelText(/Confirm password/i), "password123");
    await browser.click(screen.getByRole("button", { name: /Create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists.",
    );
    expect(screen.getByRole("link", { name: /Log in instead/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty signup form before calling the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const browser = userEvent.setup();
    render(<App />);
    await browser.click(screen.getByRole("button", { name: /Create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Complete all required fields.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty profile before calling the backend", async () => {
    storeUser();
    window.history.pushState({}, "", "/profile");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const browser = userEvent.setup();
    render(<App />);
    await browser.click(screen.getByRole("button", { name: /Save and analyze profile/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Complete all required fields.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the recommendations empty state", async () => {
    storeUser();
    window.history.pushState({}, "", "/recommendations");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ user_id: 1, recommendations: [] })),
    );

    render(<App />);

    expect(await screen.findByText("No recommendations yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Update profile/i })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("shows a recommendation error and retries successfully", async () => {
    storeUser();
    window.history.pushState({}, "", "/recommendations");
    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      return attempt === 1
        ? Response.json({ detail: "Recommendations are temporarily unavailable." }, { status: 503 })
        : Response.json({ user_id: 1, recommendations: [recommendations[0]] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const browser = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recommendations are temporarily unavailable.",
    );
    await browser.click(screen.getByRole("button", { name: /Try again/i }));

    expect(
      await screen.findByRole("heading", { name: "Backend Development Internship" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the logged-in user after a page refresh", async () => {
    storeUser();
    window.history.pushState({}, "", "/recommendations");
    const fetchMock = vi.fn(async () =>
      Response.json({ user_id: 1, recommendations: [recommendations[0]] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const firstRender = render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Backend Development Internship" }),
    ).toBeInTheDocument();
    firstRender.unmount();

    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Backend Development Internship" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requests password reset instructions from the forgot-password page", async () => {
    const requests: Array<{ path: string; body: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        requests.push({ path: url.pathname, body });

        if (url.pathname === "/auth/forgot-password") {
          return Response.json({
            message: "If an account exists, password reset instructions have been sent.",
          });
        }

        return Response.json({ detail: "Not found" }, { status: 404 });
      }),
    );

    window.history.pushState({}, "", "/login");
    const browser = userEvent.setup();
    render(<App />);

    await browser.click(screen.getByRole("link", { name: /Forgot password/i }));
    expect(
      await screen.findByRole("heading", { name: /Reset your password/i }),
    ).toBeInTheDocument();

    await browser.type(screen.getByLabelText(/Email address/i), user.email);
    await browser.click(screen.getByRole("button", { name: /Send reset link/i }));

    expect(
      await screen.findByText(/If an account exists for that email/i),
    ).toBeInTheDocument();
    expect(requests).toEqual([
      {
        path: "/auth/forgot-password",
        body: { email: user.email },
      },
    ]);
  });

  it("resets the password using the token from the reset link", async () => {
    const token = "valid-password-reset-token-123456789";
    const requests: Array<{ path: string; body: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        requests.push({ path: url.pathname, body });

        if (url.pathname === "/auth/reset-password") {
          return Response.json({ message: "Password reset successfully." });
        }

        return Response.json({ detail: "Not found" }, { status: 404 });
      }),
    );

    window.history.pushState({}, "", `/reset-password?token=${token}`);
    const browser = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Choose a new password/i }),
    ).toBeInTheDocument();

    await browser.type(screen.getByLabelText(/^New password/i), "newPassword123");
    await browser.type(screen.getByLabelText(/Confirm new password/i), "newPassword123");
    await browser.click(screen.getByRole("button", { name: /Reset password/i }));

    expect(
      await screen.findByText(/password has been changed successfully/i),
    ).toBeInTheDocument();
    expect(requests).toEqual([
      {
        path: "/auth/reset-password",
        body: {
          token,
          new_password: "newPassword123",
        },
      },
    ]);
  });

  it("rejects a reset link with no valid token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/reset-password");

    render(<App />);

    expect(
      await screen.findByText(/password reset link is invalid/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Request a new link/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the backend message for an expired or used reset token", async () => {
    const token = "expired-password-reset-token-123456";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { detail: "Invalid or expired password reset token." },
          { status: 400 },
        ),
      ),
    );

    window.history.pushState({}, "", `/reset-password?token=${token}`);
    const browser = userEvent.setup();
    render(<App />);

    await browser.type(screen.getByLabelText(/^New password/i), "newPassword123");
    await browser.type(screen.getByLabelText(/Confirm new password/i), "newPassword123");
    await browser.click(screen.getByRole("button", { name: /Reset password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid or expired password reset token.",
    );
  });
});

describe("Member 5 Issue #40 role-aware frontend", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/signup");
  });

  it("completes the institution signup, profile, extraction, review and publish flow", async () => {
    const description =
      "Software Engineering Internship for Computer Science students. Requires Python and SQL.";
    const requests: Array<{ path: string; method: string; body: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        const method = init?.method || "GET";
        requests.push({ path: url.pathname, method, body });

        if (url.pathname === "/auth/signup") {
          return Response.json({
            message: "User created successfully",
            user: institutionUser,
          });
        }

        if (url.pathname === "/auth/login") {
          return Response.json({
            message: "Login successful",
            user: institutionUser,
          });
        }

        if (url.pathname === "/institution/3") {
          return Response.json(
            { detail: "Institution profile not found." },
            { status: 404 },
          );
        }

        if (url.pathname === "/institution-profile") {
          return Response.json({
            message: "Institution profile saved successfully",
            institution_id: 7,
          });
        }

        if (url.pathname === "/institution/opportunities/process") {
          return Response.json({
            draft: {
              title: "Software Engineering Internship",
              category: "Internship",
              difficulty: "Intermediate",
              suitable_major: "Computer Science",
              suitable_year: 3,
              required_skills: ["Python", "SQL"],
              skills_gained: ["Backend Development", "Teamwork"],
              hours_per_week: 10,
              estimated_time: "3 months",
              cv_benefit: "Practical software engineering experience",
              link: "https://example.com/internship",
              deadline: "2026-10-30",
            },
          });
        }

        if (url.pathname === "/institution/opportunities") {
          return Response.json({
            message: "Opportunity submitted successfully",
            opportunity_id: 12,
            institution_id: 7,
            source: "institution",
          });
        }

        return Response.json({ detail: "Not found" }, { status: 404 });
      }),
    );

    const browser = userEvent.setup();
    render(<App />);

    await browser.type(screen.getByLabelText(/Full name/i), institutionUser.name);
    await browser.type(screen.getByLabelText(/Email address/i), institutionUser.email);
    await browser.selectOptions(screen.getByLabelText(/Account type/i), "institution");
    await browser.type(screen.getByLabelText(/^Password$/i), "password123");
    await browser.type(screen.getByLabelText(/Confirm password/i), "password123");
    await browser.click(screen.getByRole("button", { name: /Create account/i }));

    expect(await screen.findByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
    await browser.type(screen.getByLabelText(/Password/i), "password123");
    await browser.click(screen.getByRole("button", { name: /Log in/i }));

    expect(
      await screen.findByRole("heading", { name: /Institution dashboard/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /Complete your institution profile/i }),
    ).toBeInTheDocument();

    await browser.type(screen.getByLabelText(/Institution name/i), "AUB Career Office");
    await browser.type(
      screen.getByLabelText(/^Website/i),
      "https://www.aub.edu.lb/careerhub",
    );
    await browser.type(
      screen.getByLabelText(/Institution description/i),
      "Connects students with verified career opportunities.",
    );
    await browser.click(
      screen.getByRole("button", { name: /Save institution profile/i }),
    );

    expect(
      await screen.findByText("Institution profile saved successfully."),
    ).toBeInTheDocument();
    await browser.click(
      screen.getByRole("link", { name: /Create opportunity/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /Paste an opportunity description/i }),
    ).toBeInTheDocument();
    await browser.type(screen.getByLabelText(/Opportunity description/i), description);
    await browser.click(
      screen.getByRole("button", { name: /Review extracted fields/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /Review every field/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Opportunity title/i)).toHaveValue(
      "Software Engineering Internship",
    );
    expect(screen.getByLabelText(/Category/i)).toHaveValue("Internship");
    expect(screen.getByLabelText(/Suitable major/i)).toHaveValue("Computer Science");

    await browser.clear(screen.getByLabelText(/CV benefit/i));
    await browser.type(
      screen.getByLabelText(/CV benefit/i),
      "Reviewed practical engineering experience",
    );
    await browser.click(
      screen.getByRole("button", { name: /Publish reviewed opportunity/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /Published successfully/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Opportunity ID: 12/i)).toBeInTheDocument();

    await waitFor(() => expect(requests).toHaveLength(6));
    expect(requests.map((request) => request.path)).toEqual([
      "/auth/signup",
      "/auth/login",
      "/institution/3",
      "/institution-profile",
      "/institution/opportunities/process",
      "/institution/opportunities",
    ]);
    expect(requests[0].body).toEqual({
      name: institutionUser.name,
      email: institutionUser.email,
      password: "password123",
      role: "institution",
    });
    expect(requests[3].body).toEqual({
      user_id: 3,
      institution_name: "AUB Career Office",
      website: "https://www.aub.edu.lb/careerhub",
      description: "Connects students with verified career opportunities.",
    });
    expect(requests[4].body).toEqual({
      user_id: 3,
      description,
    });
    expect(requests[5].body).toEqual({
      user_id: 3,
      title: "Software Engineering Internship",
      category: "Internship",
      difficulty: "Intermediate",
      suitable_major: "Computer Science",
      suitable_year: 3,
      required_skills: ["Python", "SQL"],
      skills_gained: ["Backend Development", "Teamwork"],
      hours_per_week: 10,
      estimated_time: "3 months",
      cv_benefit: "Reviewed practical engineering experience",
      link: "https://example.com/internship",
      deadline: "2026-10-30",
    });
  });

  it("shows the editable offline fallback honestly when AI extraction is unavailable", async () => {
    storeInstitutionUser();
    window.history.pushState({}, "", "/institution/opportunities/new");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          draft: {
            title: "Open engineering workshop",
            category: null,
            difficulty: null,
            suitable_major: null,
            suitable_year: null,
            required_skills: [],
            skills_gained: [],
            hours_per_week: null,
            estimated_time: null,
            cv_benefit: null,
            link: null,
            deadline: null,
          },
          warning:
            "AI processing was unavailable. Please review and complete the draft manually.",
        }),
      ),
    );

    const browser = userEvent.setup();
    render(<App />);

    await browser.type(
      screen.getByLabelText(/Opportunity description/i),
      "Open engineering workshop",
    );
    await browser.click(
      screen.getByRole("button", { name: /Review extracted fields/i }),
    );

    expect(await screen.findByText("Generated offline")).toBeInTheDocument();
    expect(screen.getByText(/AI processing was unavailable/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Opportunity title/i)).toHaveValue(
      "Open engineering workshop",
    );

    await browser.click(
      screen.getByRole("button", { name: /Publish reviewed opportunity/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Complete the title, category, difficulty and suitable major.",
    );
  });

  it("loads a cached fallback roadmap and identifies its source", async () => {
    storeUser();
    window.history.pushState({}, "", "/roadmap");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        user_id: 1,
        source: "fallback",
        generated_at: "2026-08-14T10:24:04",
        roadmap: {
          summary:
            "A rules-based roadmap focused on closing skill gaps and preparing for top matches.",
          milestones: [
            {
              title: "Strengthen version control skills",
              description: "Practice Git workflows used in team projects.",
              skills_to_learn: ["Git"],
              suggested_timeframe: "2-3 weeks",
            },
          ],
          recommended_next_steps: ["Learn Git", "Apply to your strongest match"],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("Generated offline")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Strengthen version control skills" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Learn Git")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/student/1/roadmap");
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
  });

  it("generates and displays a roadmap when no cached roadmap exists", async () => {
    storeUser();
    window.history.pushState({}, "", "/roadmap");
    const requests: Array<{ method: string; path: string }> = [];
    let attempt = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        requests.push({ method: init?.method || "GET", path: url.pathname });
        attempt += 1;

        if (attempt === 1) {
          return Response.json({ detail: "Roadmap not found." }, { status: 404 });
        }

        return Response.json({
          user_id: 1,
          source: "fallback",
          roadmap: {
            summary: "A practical fallback roadmap.",
            milestones: [
              {
                title: "Build core skills",
                description: "Practice the skills required by your strongest matches.",
                skills_to_learn: ["Git"],
                suggested_timeframe: "2-4 weeks",
              },
            ],
            recommended_next_steps: ["Learn Git"],
          },
        });
      }),
    );

    const browser = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("No roadmap generated yet")).toBeInTheDocument();
    await browser.click(
      screen.getByRole("button", { name: /Generate my roadmap/i }),
    );

    expect(await screen.findByText("Generated offline")).toBeInTheDocument();
    expect(screen.getByText("A practical fallback roadmap.")).toBeInTheDocument();
    expect(requests).toEqual([
      { method: "GET", path: "/student/1/roadmap" },
      { method: "POST", path: "/student/1/roadmap" },
    ]);
  });

  it("shows a roadmap loading error and retries the cached request", async () => {
    storeUser();
    window.history.pushState({}, "", "/roadmap");
    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      return attempt === 1
        ? Response.json({ detail: "Roadmap service unavailable." }, { status: 503 })
        : Response.json({
            user_id: 1,
            source: "ai",
            roadmap: {
              summary: "Recovered AI-assisted roadmap.",
              milestones: [],
              recommended_next_steps: [],
            },
          });
    });
    vi.stubGlobal("fetch", fetchMock);

    const browser = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Roadmap service unavailable.",
    );
    await browser.click(
      screen.getByRole("button", { name: /Try loading again/i }),
    );

    expect(await screen.findByText("AI-assisted roadmap")).toBeInTheDocument();
    expect(screen.getByText("Recovered AI-assisted roadmap.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps institution users out of student-only routes", async () => {
    storeInstitutionUser();
    window.history.pushState({}, "", "/profile");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: 7,
          user_id: 3,
          institution_name: "AUB Career Office",
          website: null,
          description: null,
        }),
      ),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Institution dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Build your student profile/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps student users out of institution-only routes", async () => {
    storeUser();
    window.history.pushState({}, "", "/institution/dashboard");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Build your student profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Institution dashboard/i }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes unsupported homepage claims and names only real AI features", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.queryByText(/2,400\+ students matched/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/95% fit accuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thousands of real opportunities/i)).not.toBeInTheDocument();
    expect(screen.getByText("Rule-based profile analysis")).toBeInTheDocument();
    expect(screen.getByText("Transparent match scores")).toBeInTheDocument();
    expect(screen.getByText("AI-assisted roadmaps")).toBeInTheDocument();
  });
});
