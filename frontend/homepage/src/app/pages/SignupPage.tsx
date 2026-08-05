import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { ApiError, signup } from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, TextInput } from "../components/FormField";
import PageCard from "../components/PageCard";

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setDuplicateEmail(false);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setError("Complete all required fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signup(trimmedName, trimmedEmail, password);
      navigate("/login", { state: { email: trimmedEmail, accountCreated: true } });
    } catch (requestError) {
      const isDuplicate =
        requestError instanceof ApiError &&
        requestError.status === 400 &&
        /email already registered/i.test(requestError.message);

      setDuplicateEmail(isDuplicate);
      setError(
        isDuplicate
          ? "An account with this email already exists."
          : requestError instanceof Error
            ? requestError.message
            : "Could not create account.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlowLayout>
      <PageCard
        eyebrow="Step 1 of 5"
        title="Create your account"
        description="Use your university email to begin your Skill+ profile."
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <Field label="Full name">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your full name"
              autoComplete="name"
              required
            />
          </Field>

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

          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Password">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Confirm password">
              <TextInput
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              <p>{error}</p>
              {duplicateEmail && (
                <Link
                  to="/login"
                  state={{ email: email.trim() }}
                  className="inline-block mt-2 font-semibold text-blue-900 hover:text-blue-700"
                >
                  Log in instead
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white font-semibold px-6 py-3.5 rounded-full transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Create account
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-blue-900 hover:text-blue-800">
              Log in
            </Link>
          </p>
        </form>
      </PageCard>
    </FlowLayout>
  );
}
