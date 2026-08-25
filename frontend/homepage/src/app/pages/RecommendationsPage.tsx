import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Link, Navigate } from "react-router";
import {
  ApiError,
  createStudentTask,
  getStudentRecommendations,
  getStudentTasks,
  recordOpportunityView,
} from "../api";
import FlowLayout from "../components/FlowLayout";
import PageCard from "../components/PageCard";
import { getUser } from "../storage";
import type { OpportunityRecommendation } from "../types";

function formatDeadline(deadline: string | null) {
  if (!deadline) return "Open deadline";

  const parsed = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return deadline;

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function safeLink(link: string | null) {
  if (!link) return null;

  try {
    const url = new URL(link);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function RecommendationsPage() {
  const user = getUser();
  const userId = user?.id;
  const [recommendations, setRecommendations] = useState<OpportunityRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestNumber, setRequestNumber] = useState(0);
  const [addedOpportunityIds, setAddedOpportunityIds] = useState<Set<number>>(
  new Set(),
);

const [addingOpportunityIds, setAddingOpportunityIds] = useState<Set<number>>(
  new Set(),
);

const [taskError, setTaskError] = useState("");

useEffect(() => {
  if (!userId) return;

  let active = true;

  setLoading(true);
  setError("");

  Promise.all([
    getStudentRecommendations(userId),
    getStudentTasks(userId),
  ])
    .then(([recommendationResponse, taskResponse]) => {
      if (!active) return;

      setRecommendations(
        recommendationResponse.recommendations || [],
      );

      const opportunityIds = taskResponse.tasks
        .filter(
          (task) =>
            task.source === "opportunity" &&
            task.opportunity_id !== null,
        )
        .map((task) => task.opportunity_id as number);

      setAddedOpportunityIds(new Set(opportunityIds));
    })
    .catch((requestError) => {
      if (!active) return;

      setRecommendations([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load recommendations.",
      );
    })
    .finally(() => {
      if (active) setLoading(false);
    });

  return () => {
    active = false;
  };
}, [requestNumber, userId]);

async function handleAddToTodo(
  opportunity: OpportunityRecommendation,
) {
  if (!userId || addedOpportunityIds.has(opportunity.id)) {
    return;
  }

  setTaskError("");

  setAddingOpportunityIds((current) => {
    const next = new Set(current);
    next.add(opportunity.id);
    return next;
  });

  try {
    await createStudentTask(userId, {
      title: opportunity.title,
      priority: "medium",
      opportunity_id: opportunity.id,
      source: "opportunity",
    });

    setAddedOpportunityIds((current) => {
      const next = new Set(current);
      next.add(opportunity.id);
      return next;
    });
  } catch (requestError) {
    if (
      requestError instanceof ApiError &&
      requestError.status === 409
    ) {
      setAddedOpportunityIds((current) => {
        const next = new Set(current);
        next.add(opportunity.id);
        return next;
      });

      return;
    }

    setTaskError(
      requestError instanceof Error
        ? requestError.message
        : "Could not add this opportunity to your To-Do list.",
    );
  } finally {
    setAddingOpportunityIds((current) => {
      const next = new Set(current);
      next.delete(opportunity.id);
      return next;
    });
  }
}

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "institution") {
    return <Navigate to="/institution/dashboard" replace />;
  }

  return (
    <FlowLayout>
      <PageCard
        eyebrow="Opportunity matches"
        title="Your matched opportunities"
        description={`Ranked for ${user.name} using your major, level, skills, interests and preferred opportunity type.`}
      >
        {loading ? (
          <div role="status" className="flex flex-col items-center gap-3 py-14 text-blue-900">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-semibold">Finding your strongest matches...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center text-center gap-5 py-10">
            <div
              role="alert"
              className="w-full rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
            <button
              type="button"
              onClick={() => setRequestNumber((current) => current + 1)}
              className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-full transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-5 py-12">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center">
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">No recommendations yet</h2>
              <p className="text-sm text-gray-500 mt-2 max-w-md">
                No active opportunities match the current data. Update your profile or check again later.
              </p>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center justify-center gap-2 border border-blue-200 text-blue-900 hover:bg-blue-50 font-semibold px-6 py-3 rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Update profile
            </Link>
            <Link
              to="/roadmap"
              className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Build my roadmap
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <p>
                {recommendations.length} active {recommendations.length === 1 ? "opportunity" : "opportunities"}, ranked by match score.
              </p>
            </div>
            {taskError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700"
          >
            {taskError}
          </div>
        )}
            {recommendations.map((opportunity, index) => (
              <RecommendationCard
                key={opportunity.id}
                opportunity={opportunity}
                rank={index + 1}
                added={addedOpportunityIds.has(opportunity.id)}
                adding={addingOpportunityIds.has(opportunity.id)}
                onAdd={() => handleAddToTodo(opportunity)}
                onOpen={() => {
                  if (!userId) return;
                  void recordOpportunityView(opportunity.id, userId).catch(() => undefined);
                }}
              />
            ))}

            <div className="grid sm:grid-cols-2 gap-3">
              <Link
                to="/results"
                className="inline-flex items-center justify-center gap-2 border border-blue-200 text-blue-900 hover:bg-blue-50 font-semibold px-6 py-3 rounded-full transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to analysis
              </Link>
              <Link
                to="/roadmap"
                className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Build my roadmap
                <Sparkles className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </PageCard>
    </FlowLayout>
  );
}

function RecommendationCard({
  opportunity,
  rank,
  added,
  adding,
  onAdd,
  onOpen,
}: {
  opportunity: OpportunityRecommendation;
  rank: number;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const matchScore = Math.max(0, Math.min(100, Math.round(opportunity.match_score || 0)));
  const applyLink = safeLink(opportunity.link);
  const reasons = opportunity.reasons || [];

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-900 text-white text-sm font-extrabold flex items-center justify-center flex-shrink-0">
            {rank}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-gray-900 leading-snug">
              {opportunity.title}
            </h2>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                {opportunity.category || "Opportunity"}
              </span>
              <span className="rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                {opportunity.difficulty || "Any level"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 text-white px-5 py-3 text-center flex-shrink-0">
          <p className="text-2xl font-extrabold leading-none">{matchScore}%</p>
          <p className="text-[11px] font-semibold text-blue-100 uppercase tracking-wider mt-1">
            Match
          </p>
        </div>
      </div>

      <dl className="grid sm:grid-cols-3 gap-3 my-5">
        <OpportunityDetail
          icon={<Calendar className="w-4 h-4" />}
          label="Deadline"
          value={formatDeadline(opportunity.deadline)}
        />
        <OpportunityDetail
          icon={<Clock className="w-4 h-4" />}
          label="Estimated time"
          value={opportunity.estimated_time || "Not specified"}
        />
        <OpportunityDetail
          icon={<Briefcase className="w-4 h-4" />}
          label="Weekly time"
          value={
            opportunity.hours_per_week
              ? `${opportunity.hours_per_week} hours/week`
              : "Not specified"
          }
        />
      </dl>

      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          CV benefit
        </p>
        <p className="text-sm leading-relaxed text-slate-700">
          {opportunity.cv_benefit || "Builds relevant experience for your profile."}
        </p>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-5">
        <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3">
          Why this matches you
        </p>
        {reasons.length ? (
          <ul className="grid sm:grid-cols-2 gap-2 text-sm text-gray-700">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">No strong profile matches were identified yet.</p>
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={added || adding}
        className={`inline-flex w-full items-center justify-center gap-2 font-semibold px-6 py-3 rounded-full transition-colors mb-3 ${
          added
            ? "bg-green-50 border border-green-200 text-green-700 cursor-default"
            : "border border-blue-200 text-blue-900 hover:bg-blue-50 disabled:opacity-60"
        }`}
      >
        {adding ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Adding...
          </>
        ) : added ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Added to To-Do
          </>
        ) : (
          "Add to To-Do"
        )}
      </button>


      

      {applyLink ? (
        <a
          href={applyLink}
          target="_blank"
          rel="noreferrer"
          onClick={onOpen}
          className="inline-flex w-full items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-full transition-colors"
        >
          Apply for this opportunity
          <ExternalLink className="w-4 h-4" />
        </a>
      ) : (
        <p className="w-full text-center rounded-full bg-gray-100 text-gray-500 font-semibold px-6 py-3">
          Application link unavailable
        </p>
      )}
    </article>
  );
}

function OpportunityDetail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-semibold text-gray-700 mt-2">{value}</dd>
    </div>
  );
}
