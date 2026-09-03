import { useMemo } from "react";
import { computeStats, isHealthy, type BoardStats } from "../lib/stats";
import type { Task } from "../types";

export function useTaskStats(tasks: Task[]): BoardStats & { healthy: boolean } {
  return useMemo(() => {
    const stats = computeStats(tasks);
    return { ...stats, healthy: isHealthy(stats) };
  }, [tasks]);
}
