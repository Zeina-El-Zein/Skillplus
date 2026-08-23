import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Map,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Link, Navigate } from "react-router";
import {
  ApiError,
  generateStudentRoadmap,
  getStudentRoadmap,
} from "../api";
import FlowLayout from "../components/FlowLayout";
import PageCard from "../components/PageCard";
import { getUser } from "../storage";
import type { RoadmapResponse } from "../types";

function formatGeneratedAt(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function RoadmapGenerationAnimation() {
  const nodes = [
    { Icon: Brain, label: "Profile" },
    { Icon: Map, label: "Plan" },
    { Icon: CheckCircle2, label: "Ready" },
  ];

  return (
    <div
      aria-hidden="true"
      data-testid="roadmap-generation-animation"
      className="relative flex w-full max-w-xs items-start justify-between"
    >
      <div className="absolute left-8 right-8 top-6 h-1 overflow-hidden rounded-full bg-blue-100">
        <div className="roadmap-progress-line h-full rounded-full bg-blue-700" />
      </div>
      {nodes.map(({ Icon, label }, index) => (
        <div key={label} className="relative z-10 flex flex-col items-center gap-2">
          <div
            className="roadmap-progress-node flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-blue-900 text-white shadow-md"
            style={{ animationDelay: `${index * 350}ms` }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-blue-900">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function RoadmapPage() {
  const user = getUser();
  const userId = user?.id;
  const [result, setResult] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [reloadNumber, setReloadNumber] = useState(0);

  useEffect(() => {
    if (!userId || user?.role !== "student") {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    getStudentRoadmap(userId)
      .then((response) => {
        if (!active) return;
        setResult(response);
        setMissing(false);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 404) {
          setResult(null);
          setMissing(true);
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load your roadmap.",
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
  if (user.role !== "student") return <Navigate to="/institution/dashboard" replace />;

  async function generateRoadmap() {
    setGenerating(true);
    setError("");

    try {
      const response = await generateStudentRoadmap(user.id);
      setResult(response);
      setMissing(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not generate your roadmap.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const generatedAt = formatGeneratedAt(result?.generated_at);

  return (
    <FlowLayout wide>
      <PageCard
        eyebrow="Step 6 of 6"
        title="Your student roadmap"
        description="A practical plan based on your analyzed profile, skill gaps and strongest opportunity matches."
      >
        {loading ? (
          <div role="status" className="flex flex-col items-center gap-3 py-14 text-blue-900">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="font-semibold">Checking for your saved roadmap...</p>
          </div>
        ) : generating ? (
          <div role="status" className="flex flex-col items-center gap-4 py-14 text-center text-blue-900">
            <RoadmapGenerationAnimation />
            <div>
              <p className="font-bold">Building your roadmap...</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                AI generation can take a little longer. If it is unavailable, Skill+ will automatically return a complete rules-based plan.
              </p>
            </div>
          </div>
        ) : error && !result ? (
          <div className="flex flex-col items-center gap-5 py-10 text-center">
            <p role="alert" className="w-full rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setReloadNumber((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-6 py-3 font-semibold text-blue-900 hover:bg-blue-50"
              >
                <RefreshCw className="h-4 w-4" />
                Try loading again
              </button>
              <button
                type="button"
                onClick={generateRoadmap}
                className="inline-flex items-center gap-2 rounded-full bg-blue-900 px-6 py-3 font-semibold text-white hover:bg-blue-800"
              >
                <Sparkles className="h-4 w-4" />
                Generate roadmap
              </button>
            </div>
          </div>
        ) : missing ? (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-800">
              <Map className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">No roadmap generated yet</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-gray-500">
                Generate a roadmap after your profile has been saved and analyzed. The result is cached so it remains available later.
              </p>
            </div>
            {error && (
              <p role="alert" className="w-full rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={generateRoadmap}
              className="inline-flex items-center gap-2 rounded-full bg-blue-900 px-7 py-3.5 font-semibold text-white hover:bg-blue-800"
            >
              <Sparkles className="h-5 w-5" />
              Generate my roadmap
            </button>
          </div>
        ) : result ? (
          <div className="flex flex-col gap-6">
            <div
              className={`roadmap-reveal rounded-2xl border p-5 ${
                result.source === "fallback"
                  ? "border-amber-200 bg-amber-50"
                  : "border-blue-100 bg-blue-50"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {result.source === "fallback" ? (
                    <AlertTriangle className="h-5 w-5 text-amber-700" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-blue-800" />
                  )}
                  <div>
                    <p className={`font-bold ${result.source === "fallback" ? "text-amber-800" : "text-blue-900"}`}>
                      {result.source === "fallback" ? "Generated offline" : "AI-assisted roadmap"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {result.source === "fallback"
                        ? "AI was unavailable, so Skill+ used its rules-based fallback successfully."
                        : "AI output was validated before this roadmap was saved."}
                    </p>
                  </div>
                </div>
                {generatedAt && (
                  <p className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <CalendarClock className="h-4 w-4" />
                    {generatedAt}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="roadmap-reveal rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Plan summary</p>
              <p className="mt-3 text-base leading-relaxed">{result.roadmap.summary}</p>
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Milestones</h2>
              <div className="mt-4 flex flex-col gap-4">
                {result.roadmap.milestones.map((milestone, index) => (
                  <article
                    key={`${milestone.title}-${index}`}
                    className="roadmap-reveal rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
                    style={{ animationDelay: `${Math.min(index, 6) * 100}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-900 text-sm font-extrabold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <h3 className="text-lg font-extrabold text-gray-900">{milestone.title}</h3>
                          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                            {milestone.suggested_timeframe}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-600">{milestone.description}</p>
                        {milestone.skills_to_learn.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {milestone.skills_to_learn.map((skill) => (
                              <span key={skill} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
                <CheckCircle2 className="h-5 w-5 text-blue-800" />
                Recommended next steps
              </h2>
              <ol className="mt-4 space-y-3">
                {result.roadmap.recommended_next_steps.map((step, index) => (
                  <li
                    key={`${step}-${index}`}
                    className="roadmap-reveal flex items-start gap-3 text-sm text-gray-700"
                    style={{ animationDelay: `${Math.min(index, 6) * 80}ms` }}
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-900">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to="/recommendations"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-blue-200 px-6 py-3.5 font-semibold text-blue-900 hover:bg-blue-50"
              >
                <ArrowLeft className="h-4 w-4" />
                View matched opportunities
              </Link>
              <button
                type="button"
                onClick={generateRoadmap}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-900 px-6 py-3.5 font-semibold text-white hover:bg-blue-800"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate roadmap
              </button>
            </div>
          </div>
        ) : null}
      </PageCard>
    </FlowLayout>
  );
}
