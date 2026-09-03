export type Priority = "low" | "medium" | "high";
export type Status = "open" | "done";

export interface Task {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  status: Status;
  dueInDays: number;
  tags: string[];
}

export interface TaskFilter {
  query: string;
  status: Status | "all";
  priority: Priority | "all";
  overdueOnly: boolean;
}
