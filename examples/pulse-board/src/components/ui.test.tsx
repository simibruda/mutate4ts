import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge } from "./Badge";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { SearchBar } from "./SearchBar";
import { StatsBar } from "./StatsBar";
import { TaskItem } from "./TaskItem";
import type { Task } from "../types";

const openHighTask: Task = {
  id: "1",
  title: "Cover React hooks",
  notes: "useToggle",
  priority: "high",
  status: "open",
  dueInDays: -1,
  tags: ["hooks"]
};

afterEach(() => {
  cleanup();
});

describe("UI pieces", () => {
  it("marks high-priority badges as urgent and pulses the class", () => {
    render(<Badge tone="high">high</Badge>);
    const badge = screen.getByText("! high");
    expect(badge.getAttribute("data-urgent")).toBe("true");
    expect(badge.className).toContain("badge-high");
    expect(badge.className).toContain("badge-pulse");
  });

  it("leaves medium badges quiet without a bang prefix", () => {
    render(<Badge tone="medium">medium</Badge>);
    const badge = screen.getByText("medium");
    expect(screen.queryByText("! medium")).toBeNull();
    expect(badge.getAttribute("data-urgent")).toBe("false");
    expect(badge.className).toContain("badge-medium");
    expect(badge.className).not.toContain("badge-pulse");
  });

  it("treats overdue badges as urgent", () => {
    render(<Badge tone="overdue">1d overdue</Badge>);
    expect(screen.getByText("1d overdue").getAttribute("data-urgent")).toBe("true");
  });

  it("hides Clear while search is empty and shows it once there is text", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchBar value="" onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(screen.getByLabelText("Search tasks")).toBeTruthy();

    rerender(<SearchBar value="hooks" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  });

  it("clears search when the field is not empty", async () => {
    const onChange = vi.fn();
    render(<SearchBar value="hooks" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders overdue open tasks with due and urgent badges", () => {
    render(<TaskItem task={openHighTask} onToggle={vi.fn()} />);
    expect(screen.getByText("Cover React hooks")).toBeTruthy();
    expect(screen.getByText("useToggle")).toBeTruthy();
    expect(screen.getByText("1d overdue")).toBeTruthy();
    expect(screen.getByText("urgent")).toBeTruthy();
    expect(screen.queryByText("due soon")).toBeNull();
    expect(screen.getByLabelText("Toggle Cover React hooks")).toBeTruthy();
  });

  it("marks done tasks and still lets the checkbox fire", async () => {
    const onToggle = vi.fn();
    render(
      <TaskItem
        task={{ ...openHighTask, status: "done", dueInDays: 2 }}
        onToggle={onToggle}
      />
    );
    const item = screen.getByText("Cover React hooks").closest("article");
    expect(item?.className).toContain("task-done");
    expect(screen.getByText("done")).toBeTruthy();
    expect(screen.queryByText("urgent")).toBeNull();
    await userEvent.click(screen.getByLabelText("Toggle Cover React hooks"));
    expect(onToggle).toHaveBeenCalledWith("1");
  });

  it("shows due soon only for open tasks that are not overdue", () => {
    render(
      <TaskItem
        task={{ ...openHighTask, priority: "medium", dueInDays: 2 }}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByText("due soon")).toBeTruthy();
    expect(screen.queryByText("urgent")).toBeNull();
  });

  it("warns overdue and urgent stats and keeps the board labelled", () => {
    render(
      <StatsBar
        stats={{ open: 4, done: 1, overdue: 1, urgent: 2, percentComplete: 20, healthy: false }}
      />
    );
    const stats = screen.getByLabelText("Board stats");
    expect(stats.className).not.toContain("healthy");
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("20%")).toBeTruthy();
    const overdue = screen.getByText("Overdue").closest("div");
    const urgent = screen.getByText("Urgent").closest("div");
    expect(overdue?.className).toContain("warn");
    expect(urgent?.className).toContain("warn");
  });

  it("applies the healthy stats class when the board is clear", () => {
    render(
      <StatsBar
        stats={{ open: 2, done: 2, overdue: 0, urgent: 0, percentComplete: 50, healthy: true }}
      />
    );
    expect(screen.getByLabelText("Board stats").className).toContain("healthy");
    expect(screen.getByText("Overdue").closest("div")?.className).not.toContain("warn");
  });

  it("forwards filter changes from the toolbar controls", async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filter={{ query: "", status: "all", priority: "all", overdueOnly: false }}
        onChange={onChange}
      />
    );
    await userEvent.selectOptions(screen.getByLabelText("Status filter"), "open");
    expect(onChange).toHaveBeenCalledWith({
      query: "",
      status: "open",
      priority: "all",
      overdueOnly: false
    });
  });

  it("shows the empty state copy", () => {
    render(<EmptyState />);
    expect(screen.getByText("No tasks match")).toBeTruthy();
    expect(screen.getByText("Try clearing search or showing all statuses.")).toBeTruthy();
  });
});
