import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { analyzeStudentProfile, saveStudentProfile } from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, SelectInput, TextInput } from "../components/FormField";
import PageCard from "../components/PageCard";
import { getProfile, getUser, saveAnalysis, saveProfile } from "../storage";
import type { StudentProfile } from "../types";

const OPPORTUNITY_TYPES = [
  "Internship",
  "Project",
  "Workshop",
  "Bootcamp",
  "Hackathon",
  "Competition",
  "Mentorship",
  "Research",
];

const MAJORS = [
  "Computer and Communications Engineering",
  "Computer Science",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Industrial Engineering",
  "Chemical Engineering",
  "Other",
];
function listToText(values: string[]) {
  return values.join(", ");
}

function textToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getUser();
  const previous = getProfile();
  const defaults = useMemo(
    () => ({
      major: previous?.major || "",
      year: String(previous?.year_of_study || ""),
      courses: listToText(previous?.courses_taken || []),
      skills: listToText(previous?.current_skills || []),
      interests: listToText(previous?.interests || []),
      careerGoal: previous?.career_goal || "",
      availableTime: String(previous?.available_time_per_week || ""),
      opportunityType: previous?.preferred_opportunity_type || "Internship",
    }),
    [previous],
  );
  const [form, setForm] = useState(defaults);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const courses = textToList(form.courses);
    const skills = textToList(form.skills);
    const interests = textToList(form.interests);
    const year = Number(form.year);
    const availableTime = Number(form.availableTime);

    if (
      !form.major.trim() ||
      !form.year ||
      !form.courses.trim() ||
      !form.skills.trim() ||
      !form.interests.trim() ||
      !form.careerGoal.trim() ||
      !form.availableTime ||
      !form.opportunityType
    ) {
      setError("Complete all required fields.");
      return;
    }

    if (!courses.length || !skills.length || !interests.length) {
      setError("Add at least one course, skill and interest.");
      return;
    }

    if (!Number.isInteger(year) || year < 1 || year > 5) {
      setError("Select a valid year of study.");
      return;
    }

    if (!Number.isInteger(availableTime) || availableTime < 1 || availableTime > 168) {
      setError("Available hours must be a whole number between 1 and 168.");
      return;
    }

    const profile: StudentProfile = {
      user_id: user.id,
      major: form.major.trim(),
      year_of_study: year,
      courses_taken: courses,
      current_skills: skills,
      interests,
      career_goal: form.careerGoal.trim(),
      available_time_per_week: availableTime,
      preferred_opportunity_type: form.opportunityType,
    };

    setLoading(true);
    try {
      await saveStudentProfile(profile);
      const analysis = await analyzeStudentProfile(profile);
      saveProfile(profile);
      saveAnalysis(analysis);
      navigate("/results");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not analyze profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FlowLayout>
      <PageCard
        eyebrow="Step 3 of 5"
        title="Build your student profile"
        description="These fields exactly match the student profile API and database agreed by the team."
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Major">
              <SelectInput
                value={form.major}
                onChange={(event) => updateField("major", event.target.value)}
                required
              >
                <option value="" disabled>Select your major</option>
                {MAJORS.map((major) => (
                  <option key={major} value={major}>{major}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Year of study">
              <SelectInput
                value={form.year}
                onChange={(event) => updateField("year", event.target.value)}
                required
              >
                <option value="" disabled>Select your year</option>
                {[1, 2, 3, 4, 5].map((year) => (
                  <option key={year} value={year}>{`Year ${year}`}</option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <Field label="Courses taken" hint="Separate multiple courses with commas.">
            <TextInput
              value={form.courses}
              onChange={(event) => updateField("courses", event.target.value)}
              placeholder="Data Structures, OOP, Signals"
              required
            />
          </Field>

          <Field label="Current skills" hint="Separate multiple skills with commas.">
            <TextInput
              value={form.skills}
              onChange={(event) => updateField("skills", event.target.value)}
              placeholder="Python, SQL"
              required
            />
          </Field>

          <Field label="Interests" hint="Separate multiple interests with commas.">
            <TextInput
              value={form.interests}
              onChange={(event) => updateField("interests", event.target.value)}
              placeholder="AI, Backend Development"
              required
            />
          </Field>

          <Field label="Career goal">
            <TextInput
              value={form.careerGoal}
              onChange={(event) => updateField("careerGoal", event.target.value)}
              placeholder="Software Engineer"
              required
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Available hours per week">
              <TextInput
                type="number"
                min="1"
                max="168"
                value={form.availableTime}
                onChange={(event) => updateField("availableTime", event.target.value)}
                placeholder="6"
                required
              />
            </Field>
            <Field label="Preferred opportunity type">
              <SelectInput
                value={form.opportunityType}
                onChange={(event) => updateField("opportunityType", event.target.value)}
              >
                {OPPORTUNITY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </SelectInput>
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
            Save and analyze profile
          </button>
        </form>
      </PageCard>
    </FlowLayout>
  );
}
