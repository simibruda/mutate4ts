import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { computeStats, isHealthy } from "./stats";

const tasks: Task[] = [
  { id: "1", title: "A", notes: "", priority: "high", status: "open", dueInDays: -1, tags: [] },
  { id: "2", title: "B", notes: "", priority: "low", status: "done", dueInDays: 1, tags: [] },
  { id: "3", title: "C", notes: "", priority: "medium", status: "done", dueInDays: 2, tags: [] }
];

describe("stats", () => {
  it("computes board totals and health", () => {
    const stats = computeStats(tasks);
    expect(stats.total).toBe(3);
    expect(stats.open).toBe(1);
    expect(stats.done).toBe(2);
    expect(stats.overdue).toBe(1);
    expect(stats.urgent).toBe(1);
    expect(stats.percentComplete).toBe(67);
    expect(isHealthy(stats)).toBe(false);
    expect(isHealthy({ ...stats, overdue: 0, percentComplete: 50 })).toBe(true);
    expect(computeStats([]).percentComplete).toBe(0);
  });
});
