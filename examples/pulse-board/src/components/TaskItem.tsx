import { dueLabel, isDueSoon, isOverdue } from "../lib/dueDate";
import { isUrgent } from "../lib/priority";
import type { Task } from "../types";
import { Badge } from "./Badge";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
}

export function TaskItem({ task, onToggle }: TaskItemProps) {
  const overdue = task.status === "open" && isOverdue(task.dueInDays);
  const soon = task.status === "open" && isDueSoon(task.dueInDays);
  const done = task.status === "done";

  return (
    <article className={done ? "task-item task-done" : "task-item"}>
      <label className="task-check">
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(task.id)}
          aria-label={`Toggle ${task.title}`}
        />
        <span className="task-title">{task.title}</span>
      </label>
      <p className="task-notes">{task.notes}</p>
      <div className="task-meta">
        <Badge tone={task.priority}>{task.priority}</Badge>
        <Badge tone={done ? "done" : overdue ? "overdue" : "open"}>
          {done ? "done" : dueLabel(task.dueInDays)}
        </Badge>
        {soon && !overdue ? <span className="soon">due soon</span> : null}
        {isUrgent(task.priority) && task.status === "open" ? <span className="urgent">urgent</span> : null}
      </div>
    </article>
  );
}
