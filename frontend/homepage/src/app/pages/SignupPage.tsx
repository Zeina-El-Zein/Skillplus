import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { signup } from "../api";
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
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

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
      await signup(name.trim(), email.trim(), password);
      navigate("/login", { state: { email: email.trim(), accountCreated: true } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlowLayout>
      <PageCard
        eyebrow="Step 1 of 4"
        title="Create your account"
        description="Use your university email to begin your Skill+ profile."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
