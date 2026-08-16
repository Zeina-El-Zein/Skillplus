import { useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import { Link, Navigate } from "react-router";
import { submitInstitutionOpportunity } from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, SelectInput, TextAreaInput, TextInput } from "../components/FormField";
import PageCard from "../components/PageCard";
import {
  listToText,
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_DIFFICULTIES,
  SUITABLE_MAJORS,
  textToList,
} from "../constants";
import { clearOpportunityDraft, getOpportunityDraft, getUser } from "../storage";
import type {
  OpportunityCategory,
  OpportunityDifficulty,
  OpportunitySubmission,
  SuitableMajor,
} from "../types";

type ReviewForm = {
  title: string;
  category: string;
  difficulty: string;
  suitableMajor: string;
  suitableYear: string;
  requiredSkills: string;
  skillsGained: string;
  hoursPerWeek: string;
  estimatedTime: string;
  cvBenefit: string;
  link: string;
  deadline: string;
};

const EMPTY_FORM: ReviewForm = {
  title: "",
  category: "",
  difficulty: "",
  suitableMajor: "",
  suitableYear: "",
  requiredSkills: "",
  skillsGained: "",
  hoursPerWeek: "",
  estimatedTime: "",
  cvBenefit: "",
  link: "",
  deadline: "",
};

function isSafeLink(value: string) {
  if (!value) return true;

  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export default function OpportunityReviewPage() {
  const user = getUser();
  const savedDraft = getOpportunityDraft();
  const draft = savedDraft?.draft;
  const [form, setForm] = useState<ReviewForm>(() =>
    draft
      ? {
          title: draft.title || "",
          category: draft.category || "",
          difficulty: draft.difficulty || "",
          suitableMajor: draft.suitable_major || "",
          suitableYear: draft.suitable_year ? String(draft.suitable_year) : "",
          requiredSkills: listToText(draft.required_skills),
          skillsGained: listToText(draft.skills_gained),
          hoursPerWeek: draft.hours_per_week ? String(draft.hours_per_week) : "",
          estimatedTime: draft.estimated_time || "",
          cvBenefit: draft.cv_benefit || "",
          link: draft.link || "",
          deadline: draft.deadline || "",
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishedId, setPublishedId] = useState<number | null>(null);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "institution") return <Navigate to="/profile" replace />;
  if (!savedDraft && publishedId === null) {
    return <Navigate to="/institution/opportunities/new" replace />;
  }

  function updateField(field: keyof ReviewForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.title.trim() || !form.category || !form.difficulty || !form.suitableMajor) {
      setError("Complete the title, category, difficulty and suitable major.");
      return;
    }

    const suitableYear = form.suitableYear ? Number(form.suitableYear) : null;
    const hoursPerWeek = form.hoursPerWeek ? Number(form.hoursPerWeek) : null;

    if (
      suitableYear !== null &&
      (!Number.isInteger(suitableYear) || suitableYear < 1 || suitableYear > 6)
    ) {
      setError("Suitable year must be a whole number between 1 and 6.");
      return;
    }

    if (
      hoursPerWeek !== null &&
      (!Number.isInteger(hoursPerWeek) || hoursPerWeek < 1 || hoursPerWeek > 168)
    ) {
      setError("Weekly hours must be a whole number between 1 and 168.");
      return;
    }

    if (!isSafeLink(form.link.trim())) {
      setError("Application link must be a valid http or https address.");
      return;
    }

    const opportunity: OpportunitySubmission = {
      user_id: user.id,
      title: form.title.trim(),
      category: form.category as OpportunityCategory,
      difficulty: form.difficulty as OpportunityDifficulty,
      suitable_major: form.suitableMajor as SuitableMajor,
      suitable_year: suitableYear,
      required_skills: textToList(form.requiredSkills),
      skills_gained: textToList(form.skillsGained),
      hours_per_week: hoursPerWeek,
      estimated_time: form.estimatedTime.trim() || null,
      cv_benefit: form.cvBenefit.trim() || null,
      link: form.link.trim() || null,
      deadline: form.deadline || null,
    };

    setLoading(true);
    try {
      const response = await submitInstitutionOpportunity(opportunity);
      clearOpportunityDraft();
      setPublishedId(response.opportunity_id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not publish the opportunity.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (publishedId !== null) {
    return (
      <FlowLayout showSteps={false}>
        <PageCard
          eyebrow="Institution submission complete"
          title="Opportunity published"
          description="The reviewed version—not the original AI draft—was saved to Skill+."
        >
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-800">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Published successfully</h2>
              <p className="mt-2 text-sm text-gray-500">Opportunity ID: {publishedId}</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <Link
                to="/institution/dashboard"
                className="rounded-full border border-blue-200 px-6 py-3 font-semibold text-blue-900 hover:bg-blue-50"
              >
                Return to dashboard
              </Link>
              <Link
                to="/institution/opportunities/new"
                className="rounded-full bg-blue-900 px-6 py-3 font-semibold text-white hover:bg-blue-800"
              >
                Submit another opportunity
              </Link>
            </div>
          </div>
        </PageCard>
      </FlowLayout>
    );
  }

  return (
    <FlowLayout showSteps={false} wide>
      <PageCard
        eyebrow="Institution submission — Step 2 of 2"
        title="Review every field before publishing"
        description="Correct anything that was inferred incorrectly. Only this reviewed version will be saved."
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          {savedDraft?.warning && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-bold">Generated offline</p>
                <p className="mt-1 leading-relaxed">{savedDraft.warning}</p>
              </div>
            </div>
          )}

          <Field label="Opportunity title">
            <TextInput
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              required
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Category">
              <SelectInput
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
                required
              >
                <option value="" disabled>Select category</option>
                {OPPORTUNITY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Difficulty">
              <SelectInput
                value={form.difficulty}
                onChange={(event) => updateField("difficulty", event.target.value)}
                required
              >
                <option value="" disabled>Select difficulty</option>
                {OPPORTUNITY_DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>{difficulty}</option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Suitable year" hint="Optional.">
              <TextInput
                type="number"
                min="1"
                max="6"
                value={form.suitableYear}
                onChange={(event) => updateField("suitableYear", event.target.value)}
                placeholder="Any year"
              />
            </Field>
          </div>

          <Field label="Suitable major">
            <SelectInput
              value={form.suitableMajor}
              onChange={(event) => updateField("suitableMajor", event.target.value)}
              required
            >
              <option value="" disabled>Select suitable major</option>
              {SUITABLE_MAJORS.map((major) => (
                <option key={major} value={major}>{major}</option>
              ))}
            </SelectInput>
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Required skills" hint="Separate multiple skills with commas.">
              <TextInput
                value={form.requiredSkills}
                onChange={(event) => updateField("requiredSkills", event.target.value)}
                placeholder="Python, SQL"
              />
            </Field>
            <Field label="Skills gained" hint="Separate multiple skills with commas.">
              <TextInput
                value={form.skillsGained}
                onChange={(event) => updateField("skillsGained", event.target.value)}
                placeholder="FastAPI, Teamwork"
              />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Hours per week" hint="Optional.">
              <TextInput
                type="number"
                min="1"
                max="168"
                value={form.hoursPerWeek}
                onChange={(event) => updateField("hoursPerWeek", event.target.value)}
                placeholder="10"
              />
            </Field>
            <Field label="Estimated time" hint="Optional.">
              <TextInput
                value={form.estimatedTime}
                onChange={(event) => updateField("estimatedTime", event.target.value)}
                placeholder="3 months"
              />
            </Field>
            <Field label="Deadline" hint="Optional.">
              <TextInput
                type="date"
                value={form.deadline}
                onChange={(event) => updateField("deadline", event.target.value)}
              />
            </Field>
          </div>

          <Field label="CV benefit" hint="Optional.">
            <TextAreaInput
              value={form.cvBenefit}
              onChange={(event) => updateField("cvBenefit", event.target.value)}
              placeholder="Explain how this opportunity strengthens a student's CV."
              rows={4}
            />
          </Field>

          <Field label="Application link" hint="Optional. Include https:// when provided.">
            <TextInput
              type="url"
              value={form.link}
              onChange={(event) => updateField("link", event.target.value)}
              placeholder="https://institution.example/apply"
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/institution/opportunities/new"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-200 px-6 py-3.5 font-semibold text-blue-900 hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Edit description
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-900 px-6 py-3.5 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish reviewed opportunity
            </button>
          </div>
        </form>
      </PageCard>
    </FlowLayout>
  );
}
