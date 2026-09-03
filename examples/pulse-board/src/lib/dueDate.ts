export function isOverdue(dueInDays: number): boolean {
  return dueInDays < 0;
}

export function isDueSoon(dueInDays: number): boolean {
  return dueInDays >= 0 && dueInDays <= 2;
}

export function dueLabel(dueInDays: number): string {
  if (dueInDays === 0) {
    return "today";
  }
  if (dueInDays === 1) {
    return "tomorrow";
  }
  if (dueInDays < 0) {
    return `${-dueInDays}d overdue`;
  }
  return `in ${dueInDays}d`;
}

export function urgencyScore(dueInDays: number): number {
  if (dueInDays < 0) {
    return 100 + -dueInDays;
  }
  if (dueInDays === 0) {
    return 50;
  }
  return Math.max(0, 20 - dueInDays);
}
