import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CalendarClock,
  CheckCircle2,
  Circle,
  ListTodo,
  Loader2,
  Map as MapIcon,
  RefreshCw,
  Sparkles,
  Target,
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
import type {
  RoadmapOpportunityMatch,
  RoadmapResponse,
  RoadmapStep,
} from "../types";

function formatGeneratedAt(value?: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPriority(priority: RoadmapStep["priority"]) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getMatchLabel(match: RoadmapOpportunityMatch) {
  if (match.match_level === 1) {
    return "Strong step match";
  }

  if (match.match_level === 2) {
    return "Related match";
  }

  return "General recommendation";
}

function RoadmapGenerationAnimation() {
  const nodes = [
    { Icon: Brain, label: "Profile" },
    { Icon: MapIcon, label: "Plan" },
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
        <div
          key={label}
          className="relative z-10 flex flex-col items-center gap-2"
        >
          <div
            className="roadmap-progress-node flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-blue-900 text-white shadow-md"
            style={{ animationDelay: `${index * 350}ms` }}
          >
            <Icon className="h-5 w-5" />
          </div>

          <span className="text-xs font-semibold text-blue-900">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

type StepStatus = "done" | "current" | "upcoming";

function resolveStepStatuses(steps: RoadmapStep[]): Map<number, StepStatus> {
  const statuses = new Map<number, StepStatus>();
  let currentAssigned = false;

  for (const step of steps) {
    if (step.task_status === "done") {
      statuses.set(step.order, "done");
      continue;
    }

    if (!currentAssigned) {
      statuses.set(step.order, "current");
      currentAssigned = true;
    } else {
      statuses.set(step.order, "upcoming");
    }
  }

  return statuses;
}

function statusStyles(status: StepStatus) {
  switch (status) {
    case "done":
      return {
        markerClass: "border-green-500 bg-green-500 text-white",
        cardClass: "border-green-200 bg-green-50/40",
        badgeClass: "border-green-200 bg-green-50 text-green-700",
        badgeLabel: "Done",
        Icon: CheckCircle2,
      };
    case "current":
      return {
        markerClass: "border-blue-700 bg-blue-900 text-white ring-4 ring-blue-100",
        cardClass: "border-blue-300 bg-white shadow-md",
        badgeClass: "border-blue-200 bg-blue-50 text-blue-800",
        badgeLabel: "In Progress",
        Icon: Loader2,
      };
    case "upcoming":
      return {
        markerClass: "border-gray-300 bg-white text-gray-400",
        cardClass: "border-gray-200 bg-white",
        badgeClass: "border-gray-200 bg-gray-50 text-gray-500",
        badgeLabel: "To Do",
        Icon: Circle,
      };
  }
}

export default function RoadmapPage() {
  const user = getUser();
  const userId = user?.id;

  const [result, setResult] =
    useState<RoadmapResponse | null>(null);

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

        if (
          requestError instanceof ApiError &&
          requestError.status === 404
        ) {
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
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reloadNumber, user?.role, userId]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "student") {
    return (
      <Navigate
        to="/institution/dashboard"
        replace
      />
    );
  }

  const studentUser = user;

  async function generateRoadmap() {
    setGenerating(true);
    setError("");

    try {
      await generateStudentRoadmap(
        studentUser.id,
      );

      const savedRoadmap =
        await getStudentRoadmap(
          studentUser.id,
        );

        setResult(savedRoadmap);
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

  const generatedAt =
    formatGeneratedAt(result?.generated_at);
  const stepStatuses = result
    ? resolveStepStatuses(result.roadmap.steps)
    : new Map<number, StepStatus>();

  return (
    <FlowLayout wide>
      <PageCard
        eyebrow="Step 6 of 6"
        title="Your student roadmap"
        description="A practical plan based on your analyzed profile, skill gaps and strongest opportunity matches."
      >
        {loading ? (
          <div
            role="status"
            className="flex flex-col items-center gap-3 py-14 text-blue-900"
          >
            <Loader2 className="h-8 w-8 animate-spin" />

            <p className="font-semibold">
              Checking for your saved roadmap...
            </p>
          </div>
        ) : generating ? (
          <div
            role="status"
            className="flex flex-col items-center gap-4 py-14 text-center text-blue-900"
          >
            <RoadmapGenerationAnimation />

            <div>
              <p className="font-bold">
                Building your roadmap...
              </p>

              <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                AI generation can take a little longer. If it is unavailable,
                Skill+ will automatically return a complete rules-based plan.
              </p>
            </div>
          </div>
        ) : error && !result ? (
          <div className="flex flex-col items-center gap-5 py-10 text-center">
            <p
              role="alert"
              className="w-full rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setReloadNumber(
                    (current) => current + 1,
                  )
                }
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
              <MapIcon className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                No roadmap generated yet
              </h2>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-gray-500">
                Generate a roadmap after your profile has been saved and
                analyzed. The result is cached so it remains available later.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="w-full rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
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
                    <p
                      className={`font-bold ${
                        result.source === "fallback"
                          ? "text-amber-800"
                          : "text-blue-900"
                      }`}
                    >
                      {result.source === "fallback"
                        ? "Generated offline"
                        : "AI-assisted roadmap"}
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
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="roadmap-reveal rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-100">
                Plan summary
              </p>

              <p className="mt-3 text-base leading-relaxed">
                {result.roadmap.summary}
              </p>
            </div>

                        <div>
              <h2 className="text-xl font-extrabold text-gray-900">
                Roadmap timeline
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Progress reflects your shared To-Do list. Completing a
                linked task here updates its status everywhere.
              </p>

              <div className="relative mt-6 flex flex-col gap-6">
                <div
                  aria-hidden="true"
                  className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-200"
                />

                {result.roadmap.steps.map((step, index) => {
                  const stepStatus =
                    stepStatuses.get(step.order) ?? "upcoming";
                  const styles = statusStyles(stepStatus);
                  const StatusIcon = styles.Icon;

                  return (
                    <article
                      key={`${step.order}-${step.title}`}
                      className={`roadmap-reveal relative flex gap-4 rounded-2xl border p-5 ${styles.cardClass}`}
                      style={{
                        animationDelay: `${Math.min(index, 6) * 100}ms`,
                      }}
                    >
                      <div className="relative z-10 flex flex-shrink-0 flex-col items-center">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-extrabold ${styles.markerClass}`}
                        >
                          {stepStatus === "done" ? (
                            <StatusIcon className="h-5 w-5" />
                          ) : stepStatus === "current" ? (
                            <StatusIcon className="h-5 w-5 animate-spin" />
                          ) : (
                            step.order
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-extrabold text-gray-900">
                                {step.title}
                              </h3>

                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${styles.badgeClass}`}
                              >
                                {styles.badgeLabel}
                              </span>
                            </div>

                            <p className="mt-2 text-sm leading-relaxed text-gray-600">
                              {step.description}
                            </p>
                          </div>

                          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                            {formatPriority(step.priority)} priority
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {step.relevant_skill && (
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                              Skill: {step.relevant_skill}
                            </span>
                          )}

                          {step.opportunity_category && (
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                              Category: {step.opportunity_category}
                            </span>
                          )}

                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                              step.task_id
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-gray-200 bg-gray-50 text-gray-500"
                            }`}
                          >
                            <ListTodo className="h-3.5 w-3.5" />
                            {step.task_id
                              ? "Linked to To-Do"
                              : "Not added to To-Do"}
                          </span>
                        </div>

                        <div className="mt-5">
                          <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            <Target className="h-4 w-4 text-blue-800" />
                            Relevant opportunities
                          </h4>

                          {step.opportunities.length > 0 ? (
                            <div className="mt-3 grid gap-3">
                              {step.opportunities.map((match) => (
                                <div
                                  key={`${step.order}-${match.opportunity.id}`}
                                  className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <p className="font-semibold text-gray-900">
                                        {match.opportunity.title}
                                      </p>

                                      <p className="mt-1 text-xs text-gray-500">
                                        {match.opportunity.category ||
                                          "Opportunity"}
                                      </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                                        {match.score}% match
                                      </span>

                                      <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                                        {getMatchLabel(match)}
                                      </span>
                                    </div>
                                  </div>

                                  {match.reasons.length > 0 && (
                                    <ul className="mt-3 space-y-1 text-xs text-gray-600">
                                      {match.reasons.map(
                                        (reason, reasonIndex) => (
                                          <li
                                            key={`${match.opportunity.id}-${reasonIndex}`}
                                          >
                                            • {reason}
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-gray-500">
                              No matching opportunities are available for
                              this step right now.
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
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