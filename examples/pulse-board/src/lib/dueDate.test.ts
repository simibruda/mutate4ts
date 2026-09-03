import { describe, expect, it } from "vitest";
import { dueLabel, isDueSoon, isOverdue, urgencyScore } from "./dueDate";

describe("dueDate", () => {
  it("classifies overdue and due-soon dates", () => {
    expect(isOverdue(-1)).toBe(true);
    expect(isOverdue(0)).toBe(false);
    expect(isDueSoon(0)).toBe(true);
    expect(isDueSoon(2)).toBe(true);
    expect(isDueSoon(3)).toBe(false);
    expect(isDueSoon(-1)).toBe(false);
  });

  it("labels and scores due dates", () => {
    expect(dueLabel(0)).toBe("today");
    expect(dueLabel(1)).toBe("tomorrow");
    expect(dueLabel(-2)).toBe("2d overdue");
    expect(dueLabel(5)).toBe("in 5d");
    expect(urgencyScore(-2)).toBe(102);
    expect(urgencyScore(0)).toBe(50);
    expect(urgencyScore(5)).toBe(15);
  });
});
