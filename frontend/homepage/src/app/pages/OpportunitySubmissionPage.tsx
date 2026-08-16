import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router";
import { processOpportunityDescription } from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, TextAreaInput } from "../components/FormField";
import PageCard from "../components/PageCard";
import { getUser, saveOpportunityDraft } from "../storage";

export default function OpportunitySubmissionPage() {
  const user = getUser();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "institution") return <Navigate to="/profile" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError("Paste the opportunity description before continuing.");
      return;
    }

    setLoading(true);
    try {
      const response = await processOpportunityDescription(user.id, trimmedDescription);
      saveOpportunityDraft(response);
      navigate("/institution/opportunities/review");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not process the opportunity description.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlowLayout showSteps={false} wide>
      <PageCard
        eyebrow="Institution submission — Step 1 of 2"
        title="Paste an opportunity description"
        description="Skill+ will prepare a draft for review. Nothing is saved or published during this step."
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-relaxed text-blue-900">
            <div className="mb-2 flex items-center gap-2 font-bold">
              <Sparkles className="h-4 w-4" />
              AI-assisted extraction with a safe fallback
            </div>
            <p>
              If AI is unavailable, Skill+ still creates an editable draft instead of failing. You always review every field before publishing.
            </p>
          </div>

          <Field
            label="Opportunity description"
            hint="Include the title, category, suitable students, skills, time commitment, deadline and application link when available."
          >
            <TextAreaInput
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Paste the complete opportunity description here..."
              rows={12}
              required
            />
          </Field>

          {loading && (
            <div role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900">
              <div className="flex items-center gap-3 font-semibold">
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing your editable draft...
              </div>
              <p className="mt-2 pl-8 text-blue-700">
                This can take a little longer while the AI service responds.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/institution/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-200 px-6 py-3.5 font-semibold text-blue-900 hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-900 px-6 py-3.5 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Review extracted fields
            </button>
          </div>
        </form>
      </PageCard>
    </FlowLayout>
  );
}
