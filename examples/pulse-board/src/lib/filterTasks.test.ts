import { describe, expect, it } from "vitest";
import type { Task, TaskFilter } from "../types";
import { filterTasks, openTasks } from "./filterTasks";

const tasks: Task[] = [
  { id: "1", title: "A", notes: "", priority: "high", status: "open", dueInDays: -1, tags: [] },
  { id: "2", title: "B", notes: "", priority: "low", status: "done", dueInDays: 4, tags: [] }
];

const all: TaskFilter = { query: "", status: "all", priority: "all", overdueOnly: false };

describe("filterTasks", () => {
  it("filters by status, priority, and overdue flag", () => {
    expect(filterTasks(tasks, { ...all, status: "open" }).map((task) => task.id)).toEqual(["1"]);
    expect(filterTasks(tasks, { ...all, priority: "low" }).map((task) => task.id)).toEqual(["2"]);
    expect(filterTasks(tasks, { ...all, overdueOnly: true }).map((task) => task.id)).toEqual(["1"]);
    expect(openTasks(tasks)).toHaveLength(1);
  });
});
