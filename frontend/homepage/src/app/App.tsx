import { useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router";
import {
  User,
  BarChart2,
  Zap,
  Map,
  CheckCircle2,
  ArrowRight,
  Star,
  Brain,
  Sparkles,
  Target,
  TrendingUp,
  Menu,
  X,
  Building2,
} from "lucide-react";
import SiteFooter from "./components/SiteFooter";
import ToDoPage from "./pages/ToDoPage";
import InstitutionDashboardPage from "./pages/InstitutionDashboardPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import OpportunityReviewPage from "./pages/OpportunityReviewPage";
import OpportunitySubmissionPage from "./pages/OpportunitySubmissionPage";
import ProfilePage from "./pages/ProfilePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import RoadmapPage from "./pages/RoadmapPage";
import ResultsPage from "./pages/ResultsPage";
import SignupPage from "./pages/SignupPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import { authenticatedHome } from "./routing";
import { getUser } from "./storage";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Opportunities", href: "#opportunities" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "About", href: "#about" },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>

          <span
            className="text-xl font-extrabold tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0D1B2A" }}
          >
            Skill<span className="text-blue-900">+</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 hover:text-blue-900 transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-semibold text-blue-900 hover:text-blue-800 transition-colors px-3 py-1.5"
          >
            Log In
          </button>

          <button
            onClick={() => navigate("/signup")}
            className="text-sm font-semibold text-white bg-blue-900 hover:bg-blue-800 transition-colors px-4 py-2 rounded-full shadow-sm"
          >
            Sign Up
          </button>
        </div>

        <button
          className="md:hidden text-gray-600 hover:text-blue-900 transition-colors"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-border px-6 py-4 flex flex-col gap-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-700"
            >
              {link.label}
            </a>
          ))}

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-semibold text-blue-900 rounded-full px-4 py-2"
            >
              Log In
            </button>

            <button
              onClick={() => navigate("/signup")}
              className="text-sm font-semibold text-white bg-blue-900 rounded-full px-4 py-2"
            >
              Sign Up
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const navigate = useNavigate();

  return (
    <section id="home" className="relative overflow-hidden pt-24 pb-28 px-6">
      <div
        className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #1E3A8A, transparent 70%)" }}
      />

      <div
        className="absolute -bottom-24 right-0 w-[420px] h-[420px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #1D4ED8, transparent 70%)" }}
      />

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-900 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full mb-8">
          <Brain className="w-3.5 h-3.5" />
          Personalized Opportunity Guidance
        </div>

        <h1
          className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0D1B2A" }}
        >
          Find opportunities that{" "}
          <span
            className="relative inline-block"
            style={{
              background: "linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            actually fit
          </span>{" "}
          your level.
        </h1>

        <p
          className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Skill+ uses your saved profile to rank active opportunities, explain each score, show
          skill gaps, and build a practical roadmap.
        </p>

        <div className="flex items-center justify-center">
          <button
            onClick={() => navigate("/signup")}
            className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-base px-7 py-3.5 rounded-full shadow-lg shadow-blue-200 transition-all hover:shadow-blue-300 hover:-translate-y-0.5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>

        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
          {["Rule-based profile analysis", "Transparent match scores", "AI-assisted roadmaps"].map(
            (stat) => (
              <div key={stat} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-700" />
                <span style={{ fontFamily: "'Inter', sans-serif" }}>{stat}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    number: "01",
    icon: User,
    title: "Create your profile",
    desc: "Tell us your year, courses, skills, interests, and how many hours per week you can dedicate.",
  },
  {
    number: "02",
    icon: BarChart2,
    title: "Get your level analyzed",
    desc: "Skill+ applies explicit, testable rules to your courses and skills to determine your current readiness.",
  },
  {
    number: "03",
    icon: Target,
    title: "Receive matched opportunities",
    desc: "Browse recommendations ranked by fit score with clear explanations of why each one suits you.",
  },
  {
    number: "04",
    icon: Map,
    title: "Follow your roadmap",
    desc: "Get a personalized step-by-step plan to close skill gaps and reach your career goals.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p
            className="text-blue-900 font-semibold text-sm uppercase tracking-widest mb-3"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            The Process
          </p>

          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            How Skill+ Works
          </h2>

          <p
            className="text-gray-500 mt-4 max-w-xl mx-auto text-lg"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Four clear steps using transparent analysis, ranked matches, and an AI-assisted roadmap.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="relative bg-gradient-to-b from-blue-50/60 to-white border border-blue-100 rounded-2xl p-7 flex flex-col gap-4 hover:shadow-lg hover:shadow-blue-100 transition-all hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-blue-900 flex items-center justify-center shadow-sm shadow-blue-300">
                  <step.icon className="w-5 h-5 text-white" />
                </div>

                <span
                  className="text-4xl font-extrabold text-blue-100 select-none"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {step.number}
                </span>
              </div>

              <h3
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {step.title}
              </h3>

              <p
                className="text-sm text-gray-500 leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: User,
    color: "from-blue-900 to-blue-700",
    bg: "bg-blue-50",
    title: "Student Profile Analysis",
    desc: "We consider your year, courses, skills, interests, time availability, and career goals to build an academic snapshot.",
  },
  {
    icon: Star,
    color: "from-blue-700 to-blue-600",
    bg: "bg-blue-50",
    title: "Fit Score",
    desc: "Every opportunity gets a percentage fit score based on how closely it matches your current level and skill set.",
  },
  {
    icon: TrendingUp,
    color: "from-blue-600 to-blue-800",
    bg: "bg-blue-50",
    title: "Skill Gap Analysis",
    desc: "See which skills and experience gaps to address before applying to stronger opportunity matches.",
  },
  {
    icon: Brain,
    color: "from-blue-700 to-blue-900",
    bg: "bg-blue-50",
    title: "AI Roadmap",
    desc: "A personalized, time-aware plan that takes into account your semester schedule and career timeline.",
  },
  {
    icon: Building2,
    color: "from-blue-600 to-blue-700",
    bg: "bg-blue-50",
    title: "Institution Submissions",
    desc: "Institution accounts can review structured opportunity fields before publishing them to the shared opportunity catalog.",
  },
];

function Features() {
  return (
    <section id="roadmap" className="py-24 px-6" style={{ background: "#F8FAFF" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p
            className="text-blue-700 font-semibold text-sm uppercase tracking-widest mb-3"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Platform Features
          </p>

          <h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Everything you need to grow
          </h2>

          <p
            className="text-gray-500 mt-4 max-w-xl mx-auto text-lg"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Purpose-built tools to guide engineering students at every stage of their career journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className={`bg-white border border-border rounded-2xl p-7 flex flex-col gap-4 hover:shadow-xl hover:shadow-blue-100/50 transition-all hover:-translate-y-1 ${
                i === 4 ? "md:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center`}>
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center`}
                >
                  <f.icon className="w-4 h-4 text-white" />
                </div>
              </div>

              <h3
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {f.title}
              </h3>

              <p
                className="text-sm text-gray-500 leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecommendationCard() {
  return (
    <section id="opportunities" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p
              className="text-blue-900 font-semibold text-sm uppercase tracking-widest mb-3"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Illustrative Example
            </p>

            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-5"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              See how a recommendation is explained
            </h2>

            <p
              className="text-gray-500 text-lg leading-relaxed mb-8"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Skill+ explains every recommendation in plain language — no black boxes. You always
              know exactly why an opportunity was suggested and what to do next.
            </p>

            <div className="flex flex-col gap-4">
              {[
                "Tailored to your exact skill level",
                "Missing skills clearly highlighted",
                "Scoring reasons shown in plain English",
              ].map((point) => (
                <div key={point} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-900" />
                  </div>

                  <span
                    className="text-gray-700 text-sm font-medium"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute inset-0 rounded-3xl blur-2xl opacity-20 pointer-events-none"
              style={{ background: "linear-gradient(135deg, #1E3A8A, #1D4ED8)" }}
            />

            <div className="relative bg-white border border-blue-100 rounded-2xl shadow-xl shadow-blue-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-indigo-200 text-xs font-semibold uppercase tracking-widest">
                      Project Opportunity
                    </span>

                    <h3
                      className="text-white text-xl font-bold mt-1"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      Beginner Web Development Project
                    </h3>

                    <p className="text-indigo-200 text-sm mt-1">
                      Personal Portfolio with React · 4–6 weeks · Remote
                    </p>
                  </div>

                  <div className="flex flex-col items-center bg-white/20 rounded-xl px-3 py-2 backdrop-blur-sm flex-shrink-0 ml-4">
                    <span className="text-white font-extrabold text-2xl leading-none">92%</span>
                    <span className="text-indigo-200 text-xs font-medium">match</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 flex flex-col gap-5">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-900" />

                    <span
                      className="text-blue-800 text-xs font-bold uppercase tracking-wider"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      Why this fits you
                    </span>
                  </div>

                  <p
                    className="text-gray-600 text-sm leading-relaxed"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    You've completed CS101 and have basic HTML/CSS experience. This project matches
                    your current level and aligns with your goal of landing a frontend internship by
                    next semester.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p
                      className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      Required skills
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {["HTML/CSS", "JavaScript", "Git"].map((s) => (
                        <span
                          key={s}
                          className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1"
                        >
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p
                      className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      Missing skills
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {["React basics", "npm"].map((s) => (
                        <span
                          key={s}
                          className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1"
                        >
                          + {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button className="w-full text-sm font-semibold text-white bg-blue-900 hover:bg-blue-800 transition-colors rounded-full py-3 flex items-center justify-center gap-2">
                  View Opportunity
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 bg-white border border-blue-100 shadow-lg rounded-xl px-4 py-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span
                className="text-xs font-semibold text-gray-700"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Match reasons stay visible and reviewable
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const OPPORTUNITY_TYPES = [
  "Projects",
  "Internships",
  "Workshops",
  "Bootcamps",
  "Hackathons",
  "Competitions",
  "Mentorships",
  "Research",
];

function OpportunityPills() {
  return (
    <section
      className="py-14 px-6 border-y border-border overflow-hidden"
      style={{ background: "#F8FAFF" }}
    >
      <div className="max-w-7xl mx-auto">
        <p
          className="text-center text-sm text-gray-400 font-medium mb-6"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Opportunities matched across
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {OPPORTUNITY_TYPES.map((type) => (
            <span
              key={type}
              className="text-sm font-semibold text-blue-800 bg-blue-50 border border-blue-100 rounded-full px-5 py-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const navigate = useNavigate();

  return (
    <section id="about" className="py-28 px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(30,58,138,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          Start today — it's free for students
        </div>

        <h2
          className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Start building your CV with the{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            right opportunities.
          </span>
        </h2>

        <p
          className="text-gray-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Create a profile, review your ranked opportunities, and turn your strongest matches into
          a practical next-step plan.
        </p>

        <button
          onClick={() => navigate("/signup")}
          className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-bold text-lg px-9 py-4 rounded-full shadow-xl shadow-blue-200 transition-all hover:shadow-blue-300 hover:-translate-y-0.5"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Create Profile
          <ArrowRight className="w-5 h-5" />
        </button>

        <p
          className="text-gray-400 text-sm mt-5"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          No credit card required · Takes 5 minutes · University email preferred
        </p>
      </div>
    </section>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav />
      <Hero />
      <OpportunityPills />
      <HowItWorks />
      <Features />
      <RecommendationCard />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function LoggedInRedirect({ children }: { children: ReactNode }) {
  const user = getUser();

  if (user) {
    return (
      <Navigate
        to={authenticatedHome(user)}
        replace
      />
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <LoggedInRedirect>
              <HomePage />
            </LoggedInRedirect>
          }
        />

        <Route
          path="/signup"
          element={
            <LoggedInRedirect>
              <SignupPage />
            </LoggedInRedirect>
          }
        />

        <Route
          path="/login"
          element={
            <LoggedInRedirect>
              <LoginPage />
            </LoggedInRedirect>
          }
        />

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          path="/institution/dashboard"
          element={<InstitutionDashboardPage />}
        />

        <Route
          path="/institution/opportunities/new"
          element={<OpportunitySubmissionPage />}
        />

        <Route
          path="/institution/opportunities/review"
          element={<OpportunityReviewPage />}
        />

        <Route
          path="/dashboard"
          element={<StudentDashboardPage />}
        />

        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/todo" element={<ToDoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
