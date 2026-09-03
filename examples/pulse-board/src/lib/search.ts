import type { Task } from "../types";

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesSearch(task: Task, query: string): boolean {
  const needle = normalizeQuery(query);
  if (needle === "") {
    return true;
  }
  const haystack = `${task.title} ${task.notes} ${task.tags.join(" ")}`.toLowerCase();
  return haystack.includes(needle);
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  return tasks.filter((task) => matchesSearch(task, query));
}
