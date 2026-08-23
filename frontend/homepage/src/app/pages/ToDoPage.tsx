import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Circle, Clock3, Loader2 } from "lucide-react";
import { Navigate } from "react-router";

import {
  deleteStudentTask,
  getStudentTasks,
  updateStudentTaskPriority,
  updateStudentTaskStatus,
} from "../api";
import FlowLayout from "../components/FlowLayout";
import PageCard from "../components/PageCard";
import { getUser } from "../storage";
import type { StudentTask, TaskPriority } from "../types";

export default function ToDoPage() {
  const user = getUser();
  const userId = user?.id;

  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [updatingPriorityTaskId, setUpdatingPriorityTaskId] =
    useState<number | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;

    let active = true;

    setLoading(true);
    setError("");

    getStudentTasks(userId)
      .then((response) => {
        if (!active) return;
        setTasks(response.tasks || []);
      })
      .catch((requestError) => {
        if (!active) return;

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load your tasks.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);
  async function handleStatusChange(
  taskId: number,
  status: "todo" | "in_progress" | "done",
) {

  if (!userId) return;

  setUpdatingTaskId(taskId);
  setError("");

  try {
    const response = await updateStudentTaskStatus(
      userId,
      taskId,
      status,
    );

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? response.task : task,
      ),
    );
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : "Could not update the task.",
    );
  } finally {
    setUpdatingTaskId(null);
  }
}

    async function handlePriorityChange(
  taskId: number,
  priority: TaskPriority,
) {
  if (!userId) return;

  setUpdatingPriorityTaskId(taskId);
  setError("");

  try {
    const response = await updateStudentTaskPriority(
      userId,
      taskId,
      priority,
    );

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? response.task : task,
      ),
    );
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : "Could not update the task priority.",
    );
  } finally {
    setUpdatingPriorityTaskId(null);
  }
}
    async function handleDeleteTask(taskId: number) {
  if (!userId) return;

  setDeletingTaskId(taskId);
  setError("");

  try {
    await deleteStudentTask(userId, taskId);

    setTasks((current) =>
      current.filter((task) => task.id !== taskId),
    );
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : "Could not delete the task.",
    );
  } finally {
    setDeletingTaskId(null);
  }
}
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "institution") {
    return <Navigate to="/institution/dashboard" replace />;
  }

  const todoTasks = tasks.filter((task) => task.status === "todo");

  const inProgressTasks = tasks.filter(
    (task) => task.status === "in_progress",
  );

  const doneTasks = tasks.filter((task) => task.status === "done");

  return (
    <FlowLayout showSteps={false} wide>
      <PageCard
        eyebrow="My Tasks"
        title="Your To-Do"
        description="Keep track of opportunities and roadmap tasks you are working toward."
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-blue-900">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-semibold">Loading your tasks...</p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-5">
            <TaskSection
              title="To Do"
              icon={<Circle className="w-5 h-5" />}
              tasks={todoTasks}
              emptyMessage="Nothing waiting to be started."
              onStatusChange={handleStatusChange}
              updatingTaskId={updatingTaskId}
              onPriorityChange={handlePriorityChange}
              updatingPriorityTaskId={updatingPriorityTaskId}
              onDeleteTask={handleDeleteTask}
              deletingTaskId={deletingTaskId}
            />

            <TaskSection
              title="In Progress"
              icon={<Clock3 className="w-5 h-5" />}
              tasks={inProgressTasks}
              emptyMessage="No tasks currently in progress."
              onStatusChange={handleStatusChange}
              updatingTaskId={updatingTaskId}
              onPriorityChange={handlePriorityChange}
              updatingPriorityTaskId={updatingPriorityTaskId}
              onDeleteTask={handleDeleteTask}
              deletingTaskId={deletingTaskId}
            />

            <TaskSection
              title="Done"
              icon={<CheckCircle2 className="w-5 h-5" />}
              tasks={doneTasks}
              emptyMessage="No completed tasks yet."
              onStatusChange={handleStatusChange}
              updatingTaskId={updatingTaskId}
              onPriorityChange={handlePriorityChange}
              updatingPriorityTaskId={updatingPriorityTaskId}
              onDeleteTask={handleDeleteTask}
              deletingTaskId={deletingTaskId}
            />
          </div>
        )}
      </PageCard>
    </FlowLayout>
  );
}

function TaskSection({
  title,
  icon,
  tasks,
  emptyMessage,
  onStatusChange,
  updatingTaskId,
  onPriorityChange,
  updatingPriorityTaskId,
  onDeleteTask,
  deletingTaskId,
}: {
  title: string;
  icon: ReactNode;
  tasks: StudentTask[];
  emptyMessage: string;
  onDeleteTask: (taskId: number) => void;
  deletingTaskId: number | null;
  onStatusChange: (
    taskId: number,
    status: "todo" | "in_progress" | "done",
  ) => void;
  updatingTaskId: number | null;
  onPriorityChange: (
    taskId: number,
    priority: TaskPriority,
  ) => void;
  updatingPriorityTaskId: number | null;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 mb-4 text-gray-800">
        {icon}

        <h2 className="font-bold">{title}</h2>

        <span className="ml-auto rounded-full bg-white border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-500">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <article
              key={task.id}
              className="rounded-xl bg-white border border-gray-200 p-4"
            >
              <h3 className="font-bold text-gray-900">
                {task.title}
              </h3>

              {task.description && (
                <p className="text-sm text-gray-500 mt-2">
                  {task.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs font-semibold rounded-full bg-blue-50 text-blue-800 px-2.5 py-1">
                  {task.source === "opportunity"
                    ? "Opportunity"
                    : "Roadmap"}
                </span>

                <select
                    value={task.priority}
                    disabled={updatingPriorityTaskId === task.id}
                    onChange={(event) =>
                        onPriorityChange(
                        task.id,
                        event.target.value as TaskPriority,
                        )
                    }
                    className="text-xs font-semibold rounded-full bg-gray-100 text-gray-700 px-2.5 py-1 border border-gray-200 capitalize"
                    aria-label={`Priority for ${task.title}`}
                    >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {task.status === "todo" && (
                    <button
                    type="button"
                    disabled={updatingTaskId === task.id}
                    onClick={() => onStatusChange(task.id, "in_progress")}
                    className="text-sm font-semibold bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-full disabled:opacity-50"
                    >
                    {updatingTaskId === task.id ? "Updating..." : "Start"}
                    </button>
                )}

                {task.status === "in_progress" && (
                    <>
                    <button
                        type="button"
                        disabled={updatingTaskId === task.id}
                        onClick={() => onStatusChange(task.id, "todo")}
                        className="text-sm font-semibold border border-gray-200 text-gray-700 px-4 py-2 rounded-full disabled:opacity-50"
                    >
                        Back to To Do
                    </button>

                    <button
                        type="button"
                        disabled={updatingTaskId === task.id}
                        onClick={() => onStatusChange(task.id, "done")}
                        className="text-sm font-semibold bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-full disabled:opacity-50"
                    >
                        {updatingTaskId === task.id ? "Updating..." : "Mark Done"}
                    </button>
                    </>
                )}

                {task.status === "done" && (
                    <button
                    type="button"
                    disabled={updatingTaskId === task.id}
                    onClick={() => onStatusChange(task.id, "in_progress")}
                    className="text-sm font-semibold border border-blue-200 text-blue-900 px-4 py-2 rounded-full disabled:opacity-50"
                    >
                    Move Back
                    </button>
                )}
                <button
                    type="button"
                    disabled={deletingTaskId === task.id}
                    onClick={() => onDeleteTask(task.id)}
                    className="text-sm font-semibold text-red-600 hover:bg-red-50 border border-red-200 px-4 py-2 rounded-full disabled:opacity-50"
                    >
                    {deletingTaskId === task.id ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}