import { useMemo } from "react";
import { filterTasks } from "../lib/filterTasks";
import { searchTasks } from "../lib/search";
import { sortTasks } from "../lib/sortTasks";
import type { Task, TaskFilter } from "../types";

export function useFilteredTasks(tasks: Task[], filter: TaskFilter): Task[] {
  return useMemo(() => {
    const searched = searchTasks(tasks, filter.query);
    const filtered = filterTasks(searched, filter);
    return sortTasks(filtered);
  }, [tasks, filter]);
}
