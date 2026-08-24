import type { StudentTask } from "./types";

const PRIORITY_ORDER = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

export function getCurrentTasks(tasks: StudentTask[]) {
  const inProgressTasks = tasks.filter(
    (task) => task.status === "in_progress",
  );

  if (inProgressTasks.length > 0) {
    return inProgressTasks;
  }

  const todoTasks = tasks.filter(
    (task) => task.status === "todo",
  );

  if (todoTasks.length === 0) {
    return [];
  }

  const highestPriorityValue = Math.max(
    ...todoTasks.map((task) => PRIORITY_ORDER[task.priority]),
  );

  return todoTasks.filter(
    (task) => PRIORITY_ORDER[task.priority] === highestPriorityValue,
  );
}