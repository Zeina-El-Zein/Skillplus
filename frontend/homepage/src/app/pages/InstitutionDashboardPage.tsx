import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  CheckCircle2,
  Globe2,
  Loader2,
  Pencil,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import { Link, Navigate } from "react-router";
import {
  ApiError,
  getInstitutionProfile,
  saveInstitutionProfile,
} from "../api";
import FlowLayout from "../components/FlowLayout";
import { Field, TextAreaInput, TextInput } from "../components/FormField";
import PageCard from "../components/PageCard";
import { getUser } from "../storage";
import type { InstitutionProfile } from "../types";

type InstitutionForm = {
  institutionName: string;
  website: string;
  description: string;
};

const EMPTY_FORM: InstitutionForm = {
  institutionName: "",
  website: "",
  description: "",
};

function isSafeWebsite(value: string) {
  if (!value) return true;

  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export default function InstitutionDashboardPage() {
  const user = getUser();
  const userId = user?.id;
  const [profile, setProfile] = useState<InstitutionProfile | null>(null);
  const [form, setForm] = useState<InstitutionForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadNumber, setReloadNumber] = useState(0);
  const safeProfileWebsite =
    profile?.website && isSafeWebsite(profile.website) ? profile.website : null;

  useEffect(() => {
    if (!userId || user?.role !== "institution") {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    getInstitutionProfile(userId)
      .then((result) => {
        if (!active) return;
        setProfile(result);
        setForm({
          institutionName: result.institution_name || "",
          website: result.website || "",
          description: result.description || "",
        });
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 404) {
          setProfile(null);
          setEditing(true);
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load the institution profile.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadNumber, user?.role, userId]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "institution") return <Navigate to="/profile" replace />;

  function updateField(field: keyof InstitutionForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const institutionName = form.institutionName.trim();
    const website = form.website.trim();

    if (!institutionName) {
      setError("Enter the institution name.");
      return;
    }

    if (!isSafeWebsite(website)) {
      setError("Website must be a valid http or https address.");
      return;
    }

    setSaving(true);
    try {
      const response = await saveInstitutionProfile({
        user_id: user.id,
        institution_name: institutionName,
        website: website || null,
        description: form.description.trim() || null,
      });

      setProfile({
        id: response.institution_id,
        user_id: user.id,
        institution_name: institutionName,
        website: website || null,
        description: form.description.trim() || null,
      });
      setEditing(false);
      setMessage("Institution profile saved successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save the institution profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FlowLayout showSteps={false} wide>
      <PageCard
        eyebrow="Institution workspace"
        title="Institution dashboard"
        description="Manage your institution profile, then turn an opportunity description into a reviewed listing."
      >
        {loading ? (
          <div role="status" className="flex flex-col items-center gap-3 py-14 text-blue-900">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-semibold">Loading institution workspace...</p>
          </div>
        ) : error && !editing ? (
          <div className="flex flex-col items-center gap-5 py-10 text-center">
            <p role="alert" className="w-full rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setReloadNumber((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-full bg-blue-900 px-6 py-3 font-semibold text-white hover:bg-blue-800"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {message && (
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                {message}
              </div>
            )}

            {profile && !editing ? (
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-900 text-white">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-gray-900">
                        {profile.institution_name}
                      </h2>
                      {safeProfileWebsite && (
                        <a
                          href={safeProfileWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-600"
                        >
                          <Globe2 className="h-4 w-4" />
                          {safeProfileWebsite}
                        </a>
                      )}
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
                        {profile.description || "No institution description has been added yet."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMessage("");
                      setEditing(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-200 px-5 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit profile
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} noValidate className="flex flex-col gap-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-6">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">
                    {profile ? "Edit institution profile" : "Complete your institution profile"}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    A saved institution profile is required before an opportunity can be published.
                  </p>
                </div>

                <Field label="Institution name">
                  <TextInput
                    value={form.institutionName}
                    onChange={(event) => updateField("institutionName", event.target.value)}
                    placeholder="Enter the official institution name"
                    required
                  />
                </Field>

                <Field label="Website" hint="Optional. Include https:// when provided.">
                  <TextInput
                    type="url"
                    value={form.website}
                    onChange={(event) => updateField("website", event.target.value)}
                    placeholder="https://institution.example"
                  />
                </Field>

                <Field label="Institution description" hint="Optional.">
                  <TextAreaInput
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                    placeholder="Briefly describe the institution and the opportunities it provides."
                  />
                </Field>

                {error && (
                  <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-900 px-6 py-3 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save institution profile
                  </button>
                  {profile && (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setEditing(false);
                      }}
                      className="rounded-full border border-blue-200 px-6 py-3 font-semibold text-blue-900 hover:bg-blue-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">Publish an opportunity</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
                    Paste the original description, review every extracted field, and decide what is published.
                  </p>
                </div>
                {profile ? (
                  <Link
                    to="/institution/opportunities/new"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-900 px-6 py-3 font-semibold text-white hover:bg-blue-800"
                  >
                    <PlusCircle className="h-5 w-5" />
                    Create opportunity
                  </Link>
                ) : (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                    Save the institution profile first.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </PageCard>
    </FlowLayout>
  );
}
