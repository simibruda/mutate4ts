import { describe, expect, it } from "vitest";
import { isHigherPriority, isUrgent, nextPriority, priorityRank } from "./priority";

describe("priority", () => {
  it("ranks high above medium and low", () => {
    expect(priorityRank("high")).toBe(3);
    expect(priorityRank("medium")).toBe(2);
    expect(priorityRank("low")).toBe(1);
    expect(isHigherPriority("high", "low")).toBe(true);
    expect(isHigherPriority("low", "medium")).toBe(false);
  });

  it("treats only high as urgent and cycles priority", () => {
    expect(isUrgent("high")).toBe(true);
    expect(isUrgent("medium")).toBe(false);
    expect(nextPriority("low")).toBe("medium");
    expect(nextPriority("medium")).toBe("high");
    expect(nextPriority("high")).toBe("low");
  });
});
