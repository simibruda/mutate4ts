import { FormEvent, useState } from "react";
import { nextPriority } from "../lib/priority";
import type { Priority } from "../types";

interface TaskFormProps {
  onAdd: (title: string, notes: string, priority: Priority, dueInDays: number) => void;
}

export function TaskForm({ onAdd }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueInDays, setDueInDays] = useState(1);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed === "") {
      return;
    }
    onAdd(trimmed, notes.trim(), priority, dueInDays);
    setTitle("");
    setNotes("");
    setPriority("medium");
    setDueInDays(1);
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New task"
        aria-label="Task title"
      />
      <input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notes"
        aria-label="Task notes"
      />
      <div className="form-row">
        <button type="button" onClick={() => setPriority(nextPriority(priority))}>
          Priority: {priority}
        </button>
        <label>
          Due in
          <input
            type="number"
            value={dueInDays}
            onChange={(event) => setDueInDays(Number(event.target.value))}
            aria-label="Due in days"
          />
        </label>
        <button type="submit">Add task</button>
      </div>
    </form>
  );
}
