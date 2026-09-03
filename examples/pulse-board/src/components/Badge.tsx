import { isUrgent, type Priority } from "../lib/priority";

interface BadgeProps {
  tone: Priority | "done" | "open" | "overdue";
  children: string;
}

export function Badge({ tone, children }: BadgeProps) {
  const urgent = tone === "high" || tone === "overdue";
  const className = urgent ? `badge badge-${tone} badge-pulse` : `badge badge-${tone}`;
  return (
    <span className={className} data-urgent={urgent}>
      {isUrgent(tone as Priority) ? `! ${children}` : children}
    </span>
  );
}
