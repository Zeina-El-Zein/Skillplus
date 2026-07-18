import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Link } from "react-router";
import { requestPasswordReset } from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, TextInput } from "../components/FormField";
import PageCard from "../components/PageCard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not request a password reset.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlowLayout showSteps={false}>
      <PageCard
        eyebrow="Account help"
        title="Reset your password"
        description="Enter the email address connected to your Skill+ account."
      >
        {sent ? (
          <div className="flex flex-col gap-6">
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-4 text-sm text-blue-800"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>
                If an account exists for that email, password reset instructions have been sent.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 border border-blue-200 text-blue-900 hover:bg-blue-50 font-semibold px-6 py-3.5 rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send reset link
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
