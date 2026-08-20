import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import {
  ApiError,
  analyzeStudentProfile,
  getStudentProfile,
  saveStudentProfile,
  uploadStudentProfilePicture,
} from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, SelectInput, TextInput } from "../components/FormField";
import ImageUploadField from "../components/ImageUploadField";
import PageCard from "../components/PageCard";
import {
  listToText,
  OPPORTUNITY_CATEGORIES,
  PROFILE_MAJORS,
  textToList,
} from "../constants";
import {
  getProfile,
  getUser,
  saveAnalysis,
  saveProfile,
  saveUser,
} from "../storage";
import type { StudentProfile } from "../types";

function profileToForm(profile: StudentProfile | null) {
  return {
    major: profile?.major || "",
    year: String(profile?.year_of_study || ""),
    courses: listToText(profile?.courses_taken || []),
    skills: listToText(profile?.current_skills || []),
    interests: listToText(profile?.interests || []),
    careerGoal: profile?.career_goal || "",
    availableTime: String(profile?.available_time_per_week || ""),
    opportunityType: profile?.preferred_opportunity_type || "Internship",
  };
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getUser();
  const [savedProfile, setSavedProfile] = useState<StudentProfile | null>(() =>
    getProfile(),
  );
  const [form, setForm] = useState(() => profileToForm(savedProfile));
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(
    !savedProfile && user?.role === "student" && user.has_profile === true,
  );

  useEffect(() => {
    if (
      !user ||
      user.role !== "student" ||
      user.has_profile !== true ||
      savedProfile
    ) {
      setLoadingExisting(false);
      return;
    }

    let active = true;
    setLoadingExisting(true);
    setError("");

    getStudentProfile(user.id)
      .then((profile) => {
        if (!active) return;
        setSavedProfile(profile);
        setForm(profileToForm(profile));
        saveProfile(profile);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 404) {
          saveUser({ ...user, has_profile: false });
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load your saved profile.",
        );
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });

    return () => {
      active = false;
    };
  }, [savedProfile, user?.has_profile, user?.id, user?.role]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "institution") {
    return <Navigate to="/institution/dashboard" replace />;
  }

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
      let profilePictureUrl = savedProfile?.profile_picture_url || null;

      if (profilePicture) {
        const upload = await uploadStudentProfilePicture(user.id, profilePicture);
        profilePictureUrl = upload.profile_picture_url;
      }

      const analysis = await analyzeStudentProfile(profile);
      const completeProfile = { ...profile, profile_picture_url: profilePictureUrl };
      setSavedProfile(completeProfile);
      saveProfile(completeProfile);
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
        eyebrow="Step 3 of 6"
        title="Build your student profile"
        description="These fields exactly match the student profile API and database agreed by the team."
      >
        {loadingExisting ? (
          <div role="status" className="flex flex-col items-center gap-3 py-14 text-blue-900">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="font-semibold">Loading your saved profile...</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <ImageUploadField
            label="Profile picture (optional)"
            currentUrl={savedProfile?.profile_picture_url}
            currentAlt={`${user.name}'s profile picture`}
            selectedFile={profilePicture}
            onFileChange={setProfilePicture}
            disabled={loading}
            shape="circle"
          />

          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Major">
              <SelectInput
                value={form.major}
                onChange={(event) => updateField("major", event.target.value)}
                required
              >
                <option value="" disabled>Select your major</option>
                {PROFILE_MAJORS.map((major) => (
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
                {OPPORTUNITY_CATEGORIES.map((type) => (
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
        )}
      </PageCard>
    </FlowLayout>
  );
}
