import type { Task, TaskFilter } from "../types";
import { isOverdue } from "./dueDate";

export function matchesFilter(task: Task, filter: TaskFilter): boolean {
  if (filter.status !== "all" && task.status !== filter.status) {
    return false;
  }
  if (filter.priority !== "all" && task.priority !== filter.priority) {
    return false;
  }
  if (filter.overdueOnly && !isOverdue(task.dueInDays)) {
    return false;
  }
  return true;
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  return tasks.filter((task) => matchesFilter(task, filter));
}

export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.status === "open");
}
