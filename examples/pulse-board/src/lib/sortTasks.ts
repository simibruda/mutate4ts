import type { Task } from "../types";
import { urgencyScore } from "./dueDate";
import { priorityRank } from "./priority";

export function compareTasks(left: Task, right: Task): number {
  if (left.status !== right.status) {
    return left.status === "open" ? -1 : 1;
  }
  const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  return urgencyScore(right.dueInDays) - urgencyScore(left.dueInDays);
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasks);
}
