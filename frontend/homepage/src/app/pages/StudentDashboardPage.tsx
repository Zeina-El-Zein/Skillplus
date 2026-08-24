import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import {
  ApiError,
  getStudentProfile,
  getStudentRoadmap,
  getStudentTasks,
  resolveApiAssetUrl,
} from "../api";
import FlowLayout from "../components/FlowLayout";
import { getUser } from "../storage";
import { getCurrentTasks } from "../taskUtils";
import type {
  RoadmapResponse,
  StudentProfileResponse,
  StudentTask,
} from "../types";

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

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const user = getUser();

  const userId = user?.id;
  const userRole = user?.role;

  const [profile, setProfile] =
    useState<StudentProfileResponse | null>(null);

  const [profileLoading, setProfileLoading] =
    useState(true);

  const [profileError, setProfileError] =
    useState("");

  const [currentTasks, setCurrentTasks] =
    useState<StudentTask[]>([]);

  const [tasksLoading, setTasksLoading] =
    useState(true);

  const [tasksError, setTasksError] =
    useState("");

  const [roadmap, setRoadmap] =
    useState<RoadmapResponse | null>(null);

  const [roadmapLoading, setRoadmapLoading] =
    useState(true);

  const [roadmapError, setRoadmapError] =
    useState("");

  const [roadmapMissing, setRoadmapMissing] =
    useState(false);

  useEffect(() => {
    if (!userId || userRole !== "student") {
      setProfileLoading(false);
      setTasksLoading(false);
      setRoadmapLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDashboardData(
      activeUserId: number,
    ) {
      setProfileLoading(true);
      setTasksLoading(true);
      setRoadmapLoading(true);

      setProfileError("");
      setTasksError("");
      setRoadmapError("");
      setRoadmapMissing(false);

      try {
        const profileResponse =
          await getStudentProfile(
            activeUserId,
          );

        if (!cancelled) {
          setProfile(profileResponse);
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(
            error instanceof Error
              ? error.message
              : "Could not load your student profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }

      try {
        const tasksResponse =
          await getStudentTasks(
            activeUserId,
          );

        if (!cancelled) {
          setCurrentTasks(
            getCurrentTasks(
              tasksResponse.tasks,
            ),
          );
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

      try {
        const roadmapResponse =
          await getStudentRoadmap(
            activeUserId,
          );

        if (!cancelled) {
          setRoadmap(roadmapResponse);
          setRoadmapMissing(false);
        }
      } catch (error) {
        if (!cancelled) {
          if (
            error instanceof ApiError &&
            error.status === 404
          ) {
            setRoadmap(null);
            setRoadmapMissing(true);
          } else {
            setRoadmapError(
              error instanceof Error
                ? error.message
                : "Could not load your saved roadmap.",
            );
          }
        }
      } finally {
        if (!cancelled) {
          setRoadmapLoading(false);
        }
      }
    }

    loadDashboardData(userId);

    return () => {
      cancelled = true;
    };
  }, [userId, userRole]);

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (user.role === "institution") {
    return (
      <Navigate
        to="/institution/dashboard"
        replace
      />
    );
  }

  const profilePictureUrl =
    resolveApiAssetUrl(
      profile?.profile_picture_url,
    );

  const initials =
    getInitials(user.name);

  return (
    <FlowLayout
      showSteps={false}
      wide
    >
      <div className="space-y-8">
        <div>
          <h1
            className="text-3xl font-extrabold text-gray-900"
            style={{
              fontFamily:
                "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Dashboard
          </h1>

          <p className="mt-2 text-gray-500">
            Welcome back, {user.name}. Here’s an
            overview of your Skill+ journey.
          </p>
        </div>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          {profileLoading && (
            <p className="text-sm text-gray-500">
              Loading your profile...
            </p>
          )}

          {!profileLoading &&
            profileError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm text-red-700">
                  {profileError}
                </p>
              </div>
            )}

          {!profileLoading &&
            !profileError &&
            profile && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  {profilePictureUrl ? (
                    <img
                      src={
                        profilePictureUrl
                      }
                      alt={`${user.name} profile`}
                      className="w-20 h-20 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 text-2xl font-bold">
                      {initials}
                    </div>
                  )}

                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {user.name}
                    </h2>

                    <p className="mt-1 text-gray-600">
                      {profile.major}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Year{" "}
                      {
                        profile.year_of_study
                      }
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/profile")
                    }
                    className="px-5 py-2.5 rounded-full border border-blue-900 text-blue-900 font-semibold hover:bg-blue-50 transition-colors"
                  >
                    Edit Profile
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/results")
                    }
                    className="px-5 py-2.5 rounded-full bg-blue-900 text-white font-semibold hover:bg-blue-800 transition-colors"
                  >
                    View Full Analysis
                  </button>
                </div>
              </div>
            )}
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              Your summary
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              A quick overview of your current
              profile and goals.
            </p>
          </div>

          {profileLoading && (
            <p className="text-sm text-gray-500">
              Loading your summary...
            </p>
          )}

          {!profileLoading &&
            profileError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm text-red-700">
                  {profileError}
                </p>
              </div>
            )}

          {!profileLoading &&
            !profileError &&
            profile && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Current level
                  </p>

                  <p className="mt-2 font-semibold text-gray-900">
                    {profile.level ||
                      "Not analyzed yet"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Career goal
                  </p>

                  <p className="mt-2 font-semibold text-gray-900">
                    {profile.career_goal ||
                      "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Preferred opportunity
                  </p>

                  <p className="mt-2 font-semibold text-gray-900">
                    {profile.preferred_opportunity_type ||
                      "Not specified"}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Skills
                  </p>

                  {profile.current_skills
                    .length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.current_skills.map(
                        (skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                          >
                            {skill}
                          </span>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">
                      No skills added yet.
                    </p>
                  )}
                </div>
              </div>
            )}
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Your saved roadmap
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your latest roadmap is loaded
                directly from Skill+.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/roadmap")
              }
              className="w-fit px-5 py-2.5 rounded-full border border-blue-900 text-blue-900 font-semibold hover:bg-blue-50 transition-colors"
            >
              View Roadmap
            </button>
          </div>

          {roadmapLoading && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-sm text-gray-500">
                Loading your saved roadmap...
              </p>
            </div>
          )}

          {!roadmapLoading &&
            roadmapError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-5">
                <p className="text-sm text-red-700">
                  {roadmapError}
                </p>
              </div>
            )}

          {!roadmapLoading &&
            !roadmapError &&
            roadmapMissing && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <h3 className="font-semibold text-gray-900">
                  No saved roadmap yet
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Build your roadmap to get a
                  personalized plan based on your
                  profile and opportunity matches.
                </p>
              </div>
            )}

          {!roadmapLoading &&
            !roadmapError &&
            roadmap && (
              <div className="space-y-5">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Plan summary
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-gray-700">
                    {roadmap.roadmap.summary}
                  </p>
                </div>

                {roadmap.roadmap.steps
                  .length > 0 ? (
                  <div className="grid gap-3">
                    {roadmap.roadmap.steps
                      .slice(0, 3)
                      .map((step) => (
                        <div
                          key={`${step.order}-${step.title}`}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Step{" "}
                                {step.order}
                              </p>

                              <h3 className="mt-1 font-semibold text-gray-900">
                                {step.title}
                              </h3>

                              <p className="mt-1 text-sm text-gray-600">
                                {
                                  step.relevant_skill
                                }
                              </p>
                            </div>

                            <span className="w-fit rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                              {step.priority
                                .charAt(0)
                                .toUpperCase() +
                                step.priority.slice(
                                  1,
                                )}{" "}
                              priority
                            </span>
                          </div>

                          {step.task_id && (
                            <p className="mt-3 text-xs font-medium text-gray-500">
                              Linked to your
                              shared To-Do list
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Your saved roadmap does not
                    contain any steps yet.
                  </p>
                )}

                {roadmap.roadmap.steps
                  .length > 3 && (
                  <p className="text-sm text-gray-500">
                    +
                    {roadmap.roadmap.steps
                      .length - 3}{" "}
                    more roadmap step
                    {roadmap.roadmap.steps
                      .length -
                      3 ===
                    1
                      ? ""
                      : "s"}
                  </p>
                )}
              </div>
            )}
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              Where you are now
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Your current focus and next
              recommended step.
            </p>
          </div>

          {tasksLoading && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-sm text-gray-500">
                Loading your current tasks...
              </p>
            </div>
          )}

          {!tasksLoading &&
            tasksError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-5">
                <p className="text-sm text-red-700">
                  {tasksError}
                </p>
              </div>
            )}

          {!tasksLoading &&
            !tasksError &&
            currentTasks.length ===
              0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <h3 className="font-semibold text-gray-900">
                  No current tasks yet
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  You don’t have any active tasks
                  right now. Explore your
                  recommendations or roadmap to
                  find your next step.
                </p>
              </div>
            )}

          {!tasksLoading &&
            !tasksError &&
            currentTasks.length >
              0 && (
              <div className="flex flex-col gap-4">
                {currentTasks.map(
                  (task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-5"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="font-semibold text-gray-900">
                            {
                              task.title
                            }
                          </h3>

                          <span className="shrink-0 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                            {formatStatus(
                              task.status,
                            )}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-sm text-gray-600">
                            {
                              task.description
                            }
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-500">
                          <span>
                            Priority:{" "}
                            {formatPriority(
                              task.priority,
                            )}
                          </span>

                          <span>
                            Source:{" "}
                            {task.source ===
                            "roadmap"
                              ? "Roadmap"
                              : "Opportunity"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
        </section>
      </div>
    </FlowLayout>
  );
}