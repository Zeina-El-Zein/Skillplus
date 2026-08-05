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
