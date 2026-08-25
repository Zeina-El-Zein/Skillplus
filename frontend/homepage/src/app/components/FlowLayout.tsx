import type { ReactNode } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Map,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { clearSession, getUser } from "../storage";
import SiteFooter from "./SiteFooter";

const JOURNEY_STEPS = [
  { path: "/signup", label: "Sign up" },
  { path: "/login", label: "Log in" },
  { path: "/profile", label: "Profile" },
  { path: "/results", label: "Results" },
  { path: "/recommendations", label: "Matches" },
  { path: "/roadmap", label: "Roadmap" },
];

const STUDENT_NAVIGATION = [
  { path: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { path: "/profile", label: "Profile", Icon: UserRound },
  { path: "/results", label: "Results", Icon: BarChart3 },
  { path: "/recommendations", label: "Matches", Icon: BriefcaseBusiness },
  { path: "/roadmap", label: "Roadmap", Icon: Map },
  { path: "/todo", label: "To-Do", Icon: ListTodo },
] as const;

type FlowLayoutProps = {
  children: ReactNode;
  showSteps?: boolean;
  wide?: boolean;
};

export default function FlowLayout({ children, showSteps = true, wide = false }: FlowLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const showStudentNavigation =
    user?.role === "student" && user.has_profile !== false;
  const currentStep = Math.max(
    0,
    JOURNEY_STEPS.findIndex((step) => location.pathname.startsWith(step.path)),
  );

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span
              className="text-xl font-extrabold tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0D1B2A" }}
            >
              Skill<span className="text-blue-900">+</span>
            </span>
          </Link>

          {user && (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          )}
        </div>

        {showStudentNavigation && (
          <nav
            aria-label="Student navigation"
            className="border-t border-blue-50 bg-white"
          >
            <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:grid sm:grid-cols-6 sm:gap-2 sm:px-6">
              {STUDENT_NAVIGATION.map(({ path, label, Icon }) => {
                const active = location.pathname === path;

                return (
                  <Link
                    key={path}
                    to={path}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-w-max items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 sm:min-w-0 ${
                      active
                        ? "bg-blue-900 text-white shadow-sm"
                        : "text-gray-600 hover:bg-blue-50 hover:text-blue-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className={`${wide ? "max-w-5xl" : "max-w-3xl"} mx-auto`}>
          {showSteps && !showStudentNavigation && (
            <div className="grid grid-cols-6 mb-10">
              {JOURNEY_STEPS.map((step, index) => (
                <div key={step.path} className="relative flex flex-col items-center gap-2">
                  {index > 0 && (
                    <div
                      className={`absolute right-1/2 top-4 w-full h-0.5 ${
                        index <= currentStep ? "bg-blue-700" : "bg-gray-200"
                      }`}
                    />
                  )}
                  <Link
                    to={step.path}
                    aria-current={index === currentStep ? "step" : undefined}
                    aria-label={`Go to ${step.label}`}
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      index < currentStep
                        ? "bg-blue-900 text-white"
                        : index === currentStep
                          ? "bg-blue-900 text-white ring-4 ring-blue-100"
                          : "bg-white text-gray-400 border border-gray-200"
                    }`}
                  >
                    {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                  </Link>
                  <Link
                    to={step.path}
                    className={`relative z-10 text-xs font-semibold ${
                      index <= currentStep ? "text-blue-800" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </Link>
                </div>
              ))}
            </div>
          )}

          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
