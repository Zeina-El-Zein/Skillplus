import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { getStudentTasks } from "../api";
import FlowLayout from "../components/FlowLayout";
import { getUser } from "../storage";
import { getCurrentTasks } from "../taskUtils";
import type { StudentTask } from "../types";

function formatPriority(priority: StudentTask["priority"]) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function formatStatus(status: StudentTask["status"]) {
  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "todo") {
    return "To Do";
  }

  return "Done";
}

export default function StudentDashboardPage() {
  const user = getUser();
  const userId = user?.id;
  const userRole = user?.role;

  const [currentTasks, setCurrentTasks] = useState<StudentTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  useEffect(() => {
    if (!userId || userRole !== "student") {
      setTasksLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTasks(activeUserId: number) {
      setTasksLoading(true);
      setTasksError("");

      try {
        const response = await getStudentTasks(activeUserId);

        if (!cancelled) {
          setCurrentTasks(getCurrentTasks(response.tasks));
        }
      } catch (error) {
        if (!cancelled) {
          setTasksError(
            error instanceof Error
              ? error.message
              : "Could not load your current tasks.",
          );
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    }

    loadTasks(userId);

    return () => {
      cancelled = true;
    };
  }, [userId, userRole]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "institution") {
    return <Navigate to="/institution/dashboard" replace />;
  }

  return (
    <FlowLayout showSteps={false} wide>
      <div className="space-y-8">
        <div>
          <h1
            className="text-3xl font-extrabold text-gray-900"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Dashboard
          </h1>

          <p className="mt-2 text-gray-500">
            Welcome back. Here’s an overview of your Skill+ journey.
          </p>
        </div>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 text-2xl font-bold">
                SC
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Student Name
                </h2>

                <p className="mt-1 text-gray-600">
                  Major
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Year of study
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="px-5 py-2.5 rounded-full border border-blue-900 text-blue-900 font-semibold hover:bg-blue-50 transition-colors"
              >
                Edit Profile
              </button>

              <button
                type="button"
                className="px-5 py-2.5 rounded-full bg-blue-900 text-white font-semibold hover:bg-blue-800 transition-colors"
              >
                View Full Analysis
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              Your summary
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              A quick overview of your current profile and goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Current level
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                Student level
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Career goal
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                Career goal
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Preferred opportunity
              </p>

              <p className="mt-2 font-semibold text-gray-900">
                Opportunity type
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Skills
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  Skill
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              Where you are now
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Your current focus and next recommended step.
            </p>
          </div>

          {tasksLoading && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-sm text-gray-500">
                Loading your current tasks...
              </p>
            </div>
          )}

          {!tasksLoading && tasksError && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-5">
              <p className="text-sm text-red-700">
                {tasksError}
              </p>
            </div>
          )}

          {!tasksLoading &&
            !tasksError &&
            currentTasks.length === 0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <h3 className="font-semibold text-gray-900">
                  No current tasks yet
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  You don’t have any active tasks right now. Explore your
                  recommendations or roadmap to find your next step.
                </p>
              </div>
            )}

          {!tasksLoading &&
            !tasksError &&
            currentTasks.length > 0 && (
              <div className="flex flex-col gap-4">
                {currentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-5"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-semibold text-gray-900">
                          {task.title}
                        </h3>

                        <span className="shrink-0 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                          {formatStatus(task.status)}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-sm text-gray-600">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-500">
                        <span>
                          Priority: {formatPriority(task.priority)}
                        </span>

                        <span>
                          Source:{" "}
                          {task.source === "roadmap"
                            ? "Roadmap"
                            : "Opportunity"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </section>
      </div>
    </FlowLayout>
  );
}