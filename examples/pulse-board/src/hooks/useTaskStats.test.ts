import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTaskStats } from "./useTaskStats";
import type { Task } from "../types";

const tasks: Task[] = [
  { id: "1", title: "A", notes: "", priority: "low", status: "done", dueInDays: 1, tags: [] },
  { id: "2", title: "B", notes: "", priority: "low", status: "done", dueInDays: 1, tags: [] }
];

describe("useTaskStats", () => {
  it("marks a completed board healthy", () => {
    const { result } = renderHook(() => useTaskStats(tasks));
    expect(result.current.percentComplete).toBe(100);
    expect(result.current.healthy).toBe(true);
  });
});
