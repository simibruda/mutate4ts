import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { matchesSearch, searchTasks } from "./search";

const task: Task = {
  id: "1",
  title: "Ship demo",
  notes: "Record video",
  priority: "high",
  status: "open",
  dueInDays: 0,
  tags: ["mutate4ts"]
};

describe("search", () => {
  it("matches title, notes, and tags and ignores blank queries", () => {
    expect(matchesSearch(task, "")).toBe(true);
    expect(matchesSearch(task, "  DEMO ")).toBe(true);
    expect(matchesSearch(task, "video")).toBe(true);
    expect(matchesSearch(task, "mutate4ts")).toBe(true);
    expect(matchesSearch(task, "missing")).toBe(false);
    expect(searchTasks([task], "ship")).toHaveLength(1);
  });
});
