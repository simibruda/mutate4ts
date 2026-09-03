import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "./Badge";
import { SearchBar } from "./SearchBar";
import { TaskItem } from "./TaskItem";
import { EmptyState } from "./EmptyState";

describe("UI pieces", () => {
  it("marks high-priority badges as urgent", () => {
    render(<Badge tone="high">high</Badge>);
    expect(screen.getByText("! high").getAttribute("data-urgent")).toBe("true");
  });

  it("clears search when the field is not empty", async () => {
    const onChange = vi.fn();
    render(<SearchBar value="hooks" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders overdue open tasks with a due badge", () => {
    render(
      <TaskItem
        task={{
          id: "1",
          title: "Cover React hooks",
          notes: "useToggle",
          priority: "high",
          status: "open",
          dueInDays: -1,
          tags: ["hooks"]
        }}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByText("Cover React hooks")).toBeTruthy();
    expect(screen.getByText("1d overdue")).toBeTruthy();
    expect(screen.getByText("urgent")).toBeTruthy();
  });

  it("shows the empty state copy", () => {
    render(<EmptyState />);
    expect(screen.getByText("No tasks match")).toBeTruthy();
  });
});
