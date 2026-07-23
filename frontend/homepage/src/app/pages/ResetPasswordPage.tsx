import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { resetPassword } from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, TextInput } from "../components/FormField";
import PageCard from "../components/PageCard";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const validToken = token.length >= 20;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!validToken) {
      setError("This password reset link is invalid. Request a new link.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, password);
      setResetComplete(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reset your password.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlowLayout showSteps={false}>
      <PageCard
        eyebrow="Account help"
        title="Choose a new password"
        description="Create a new password for your Skill+ account."
      >
        {resetComplete ? (
          <div className="flex flex-col gap-6">
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-4 text-sm text-blue-800"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>Your password has been changed successfully.</p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-6 py-3.5 rounded-full transition-colors"
            >
              Continue to log in
              <KeyRound className="w-4 h-4" />
            </Link>
          </div>
        ) : !validToken ? (
          <div className="flex flex-col gap-6">
            <p
              role="alert"
              className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700"
            >
              This password reset link is invalid. Request a new link.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center gap-2 border border-blue-200 text-blue-900 hover:bg-blue-50 font-semibold px-6 py-3.5 rounded-full transition-colors"
            >
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="New password" hint="Use at least 6 characters.">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a new password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>

            <Field label="Confirm new password">
              <TextInput
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white font-semibold px-6 py-3.5 rounded-full transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              Reset password
            </button>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-blue-900 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to log in
            </Link>
          </form>
        )}
      </PageCard>
    </FlowLayout>
  );
}
