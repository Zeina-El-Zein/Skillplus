import type { ReactNode } from "react";
import { Check, LogOut, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { clearSession, getUser } from "../storage";

const STEPS = [
  { path: "/signup", label: "Sign up" },
  { path: "/login", label: "Log in" },
  { path: "/profile", label: "Profile" },
  { path: "/results", label: "Results" },
  { path: "/recommendations", label: "Matches" },
];

type FlowLayoutProps = {
  children: ReactNode;
  showSteps?: boolean;
};

export default function FlowLayout({ children, showSteps = true }: FlowLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const currentStep = Math.max(
    0,
    STEPS.findIndex((step) => location.pathname.startsWith(step.path)),
  );

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-blue-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          )}
        </div>
      </header>

      <main className="px-6 py-10">
        <div className="max-w-3xl mx-auto">
          {showSteps && (
            <div className="grid grid-cols-5 mb-10">
              {STEPS.map((step, index) => (
                <div key={step.path} className="relative flex flex-col items-center gap-2">
                  {index > 0 && (
                    <div
                      className={`absolute right-1/2 top-4 w-full h-0.5 ${
                        index <= currentStep ? "bg-blue-700" : "bg-gray-200"
                      }`}
                    />
                  )}
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      index < currentStep
                        ? "bg-blue-900 text-white"
                        : index === currentStep
                          ? "bg-blue-900 text-white ring-4 ring-blue-100"
                          : "bg-white text-gray-400 border border-gray-200"
                    }`}
                  >
                    {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  <span
                    className={`relative z-10 text-xs font-semibold ${
                      index <= currentStep ? "text-blue-800" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {children}
        </div>
      </main>
    </div>
  );
}
