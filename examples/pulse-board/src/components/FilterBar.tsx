import type { Priority, Status, TaskFilter } from "../types";

interface FilterBarProps {
  filter: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}

export function FilterBar({ filter, onChange }: FilterBarProps) {
  return (
    <div className="filter-bar">
      <select
        aria-label="Status filter"
        value={filter.status}
        onChange={(event) => onChange({ ...filter, status: event.target.value as Status | "all" })}
      >
        <option value="all">All statuses</option>
        <option value="open">Open</option>
        <option value="done">Done</option>
      </select>
      <select
        aria-label="Priority filter"
        value={filter.priority}
        onChange={(event) => onChange({ ...filter, priority: event.target.value as Priority | "all" })}
      >
        <option value="all">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <label className="overdue-toggle">
        <input
          type="checkbox"
          checked={filter.overdueOnly}
          onChange={(event) => onChange({ ...filter, overdueOnly: event.target.checked })}
        />
        Overdue only
      </label>
    </div>
  );
}
