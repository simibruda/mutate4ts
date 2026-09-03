import type { Task } from "../types";
import { isOverdue } from "./dueDate";
import { isUrgent } from "./priority";

export interface BoardStats {
  total: number;
  open: number;
  done: number;
  overdue: number;
  urgent: number;
  percentComplete: number;
}

export function computeStats(tasks: Task[]): BoardStats {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const open = total - done;
  const overdue = tasks.filter((task) => task.status === "open" && isOverdue(task.dueInDays)).length;
  const urgent = tasks.filter((task) => task.status === "open" && isUrgent(task.priority)).length;
  const percentComplete = total === 0 ? 0 : Math.round((done * 100) / total);
  return { total, open, done, overdue, urgent, percentComplete };
}

export function isHealthy(stats: BoardStats): boolean {
  return stats.overdue === 0 && stats.percentComplete >= 50;
}
