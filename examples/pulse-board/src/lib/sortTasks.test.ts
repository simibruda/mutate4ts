import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { sortTasks } from "./sortTasks";

const tasks: Task[] = [
  { id: "done", title: "Z", notes: "", priority: "high", status: "done", dueInDays: -8, tags: [] },
  { id: "low", title: "A", notes: "", priority: "low", status: "open", dueInDays: 9, tags: [] },
  { id: "high", title: "B", notes: "", priority: "high", status: "open", dueInDays: 1, tags: [] }
];

describe("sortTasks", () => {
  it("keeps open tasks first, then higher priority", () => {
    expect(sortTasks(tasks).map((task) => task.id)).toEqual(["high", "low", "done"]);
  });
});
