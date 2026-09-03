import type { BoardStats } from "../lib/stats";

interface StatsBarProps {
  stats: BoardStats & { healthy: boolean };
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <section className={stats.healthy ? "stats-bar healthy" : "stats-bar"} aria-label="Board stats">
      <Stat label="Open" value={stats.open} />
      <Stat label="Done" value={stats.done} />
      <Stat label="Overdue" value={stats.overdue} warn={stats.overdue > 0} />
      <Stat label="Urgent" value={stats.urgent} warn={stats.urgent > 0} />
      <Stat label="Complete" value={`${stats.percentComplete}%`} />
    </section>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={warn ? "stat warn" : "stat"}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
