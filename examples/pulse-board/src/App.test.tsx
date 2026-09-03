import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("renders the board heading and a seeded task", () => {
    window.localStorage.clear();
    render(<App />);
    expect(screen.getByText("Pulse Board")).toBeTruthy();
    expect(screen.getByText("Ship mutate4ts demo")).toBeTruthy();
    expect(screen.getByLabelText("Board stats")).toBeTruthy();
  });
});
