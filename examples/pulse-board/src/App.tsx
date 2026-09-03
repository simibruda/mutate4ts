import { useMemo, useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { SearchBar } from "./components/SearchBar";
import { StatsBar } from "./components/StatsBar";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useFilteredTasks } from "./hooks/useFilteredTasks";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useTaskStats } from "./hooks/useTaskStats";
import { useToggle } from "./hooks/useToggle";
import type { Priority, Task, TaskFilter } from "./types";

const seedTasks: Task[] = [
  { id: "1", title: "Ship mutate4ts demo", notes: "Record scan and mutation results", priority: "high", status: "open", dueInDays: 0, tags: ["demo", "video"] },
  { id: "2", title: "Cover React hooks", notes: "useToggle and useFilteredTasks", priority: "high", status: "open", dueInDays: -1, tags: ["hooks"] },
  { id: "3", title: "Polish board UI", notes: "Stats, filters, empty state", priority: "medium", status: "open", dueInDays: 2, tags: ["ui"] },
  { id: "4", title: "Write logic tests", notes: "priority, due dates, search", priority: "medium", status: "done", dueInDays: -3, tags: ["tests"] },
  { id: "5", title: "Tidy copy", notes: "Keep labels short", priority: "low", status: "open", dueInDays: 7, tags: ["copy"] }
];

export function App() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("pulse-board.tasks", seedTasks);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskFilter["status"]>("all");
  const [priority, setPriority] = useState<TaskFilter["priority"]>("all");
  const [compact, toggleCompact] = useToggle(false);
  const debouncedQuery = useDebouncedValue(query, 150);
  const overdueOnly = status === "open" && query.includes("overdue");

  const filter = useMemo<TaskFilter>(
    () => ({ query: debouncedQuery, status, priority, overdueOnly }),
    [debouncedQuery, status, priority, overdueOnly]
  );
  const visible = useFilteredTasks(tasks, filter);
  const stats = useTaskStats(tasks);

  function addTask(title: string, notes: string, nextPriority: Priority, dueInDays: number): void {
    const id = String(tasks.length + 1);
    setTasks([...tasks, { id, title, notes, priority: nextPriority, status: "open", dueInDays, tags: ["new"] }]);
  }

  function toggleTask(id: string): void {
    setTasks(tasks.map((task) => (
      task.id === id
        ? { ...task, status: task.status === "done" ? "open" : "done" }
        : task
    )));
  }

  return (
    <main className={compact ? "app compact" : "app"}>
      <header className="hero">
        <div>
          <p className="eyebrow">mutate4ts example</p>
          <h1>Pulse Board</h1>
          <p className="lede">A 20-file React app with logic, hooks, and UI for mutation testing.</p>
        </div>
        <button type="button" onClick={toggleCompact}>
          {compact ? "Comfortable layout" : "Compact layout"}
        </button>
      </header>
      <StatsBar stats={stats} />
      <TaskForm onAdd={addTask} />
      <div className="toolbar">
        <SearchBar value={query} onChange={setQuery} />
        <FilterBar
          filter={filter}
          onChange={(next) => {
            setStatus(next.status);
            setPriority(next.priority);
          }}
        />
      </div>
      <TaskList tasks={visible} onToggle={toggleTask} />
    </main>
  );
}
