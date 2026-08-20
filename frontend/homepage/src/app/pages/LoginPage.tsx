import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { login } from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, TextInput } from "../components/FormField";
import PageCard from "../components/PageCard";
import { authenticatedHome } from "../routing";
import { saveUser } from "../storage";

type LoginState = {
  email?: string;
  accountCreated?: boolean;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LoginState;
  const [email, setEmail] = useState(state.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login(email.trim(), password);
      const sessionUser = {
        ...response.user,
        has_profile: response.has_profile,
      };
      saveUser(sessionUser);
      navigate(authenticatedHome(sessionUser), { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlowLayout>
      <PageCard
        eyebrow="Step 2 of 6"
        title="Welcome back"
        description="Log in to continue to your student flow or institution dashboard."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {state.accountCreated && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              Account created successfully. Log in to continue.
            </div>
          )}

          <Field label="Email address">
            <TextInput
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@mail.aub.edu"
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </Field>

          <div className="flex justify-end -mt-2">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-blue-900 hover:text-blue-700 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white font-semibold px-6 py-3.5 rounded-full transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Log in
          </button>

          <p className="text-center text-sm text-gray-500">
            Need an account?{" "}
            <Link to="/signup" className="font-semibold text-blue-900 hover:text-blue-800">
              Sign up
            </Link>
          </p>
        </form>
      </PageCard>
    </FlowLayout>
  );
}
