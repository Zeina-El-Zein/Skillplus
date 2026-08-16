import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Award, CheckCircle2, Lightbulb, Target } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import FlowLayout from "../components/FlowLayout";
import PageCard from "../components/PageCard";
import { getAnalysis, getProfile, getUser } from "../storage";

export default function ResultsPage() {
  const navigate = useNavigate();
  const user = getUser();
  const profile = getProfile();
  const result = getAnalysis();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "institution") {
    return <Navigate to="/institution/dashboard" replace />;
  }
  if (!profile || !result) return <Navigate to="/profile" replace />;

  return (
    <FlowLayout>
      <PageCard
        eyebrow="Step 4 of 6"
        title="Your analysis is ready"
        description={`Skill+ analyzed ${profile.courses_taken.length} course(s) and ${profile.current_skills.length} skill(s) for ${user.name}.`}
      >
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-2">
                Current level
              </p>
              <h2
                className="text-3xl font-extrabold"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {result.level}
              </h2>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Award className="w-7 h-7" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <ResultSection
              icon={<CheckCircle2 className="w-5 h-5" />}
              title="Strengths"
              items={result.strengths}
              empty="Your strengths will grow as you add courses and skills."
              color="blue"
            />
            <ResultSection
              icon={<Target className="w-5 h-5" />}
              title="Missing skills"
              items={result.missing}
              empty="You reached the highest current classification level."
              color="amber"
            />
          </div>

          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-6">
            <div className="flex items-center gap-2 text-blue-800 mb-3">
              <Lightbulb className="w-5 h-5" />
              <h3 className="font-bold">Suggested next step</h3>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{result.next_step}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <h3 className="font-bold text-gray-800 mb-3">Profile summary</h3>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <SummaryItem label="Major" value={profile.major} />
              <SummaryItem label="Year" value={`Year ${profile.year_of_study}`} />
              <SummaryItem label="Career goal" value={profile.career_goal} />
              <SummaryItem label="Preferred type" value={profile.preferred_opportunity_type} />
              <SummaryItem label="Courses" value={profile.courses_taken.join(", ")} />
              <SummaryItem label="Skills" value={profile.current_skills.join(", ")} />
            </dl>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="inline-flex items-center justify-center gap-2 border border-blue-200 text-blue-800 hover:bg-blue-50 font-semibold px-6 py-3.5 rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => navigate("/recommendations")}
              className="inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold px-6 py-3.5 rounded-full transition-colors"
            >
              View matched opportunities
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/roadmap")}
              className="inline-flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-100 font-semibold px-6 py-3.5 rounded-full transition-colors"
            >
              View roadmap
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </PageCard>
    </FlowLayout>
  );
}

type ResultSectionProps = {
  icon: ReactNode;
  title: string;
  items: string[];
  empty: string;
  color: "blue" | "amber";
};

function ResultSection({ icon, title, items, empty, color }: ResultSectionProps) {
  const colors = color === "blue"
    ? "bg-blue-50 border-blue-100 text-blue-800"
    : "bg-amber-50 border-amber-100 text-amber-700";

  return (
    <div className={`rounded-2xl border p-5 ${colors}`}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-bold">{title}</h3>
      </div>
      {items.length ? (
        <ul className="space-y-2 text-sm text-gray-600">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{empty}</p>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</dt>
      <dd className="text-gray-700">{value}</dd>
    </div>
  );
}
