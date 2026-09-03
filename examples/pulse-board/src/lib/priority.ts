import type { Priority } from "../types";

export function priorityRank(priority: Priority): number {
  if (priority === "high") {
    return 3;
  }
  if (priority === "medium") {
    return 2;
  }
  return 1;
}

export function isUrgent(priority: Priority): boolean {
  return priority === "high";
}

export function isHigherPriority(left: Priority, right: Priority): boolean {
  return priorityRank(left) > priorityRank(right);
}

export function nextPriority(priority: Priority): Priority {
  if (priority === "low") {
    return "medium";
  }
  if (priority === "medium") {
    return "high";
  }
  return "low";
}
