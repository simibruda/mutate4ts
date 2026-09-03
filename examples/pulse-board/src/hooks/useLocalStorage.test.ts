import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLocalStorage } from "./useLocalStorage";

describe("useLocalStorage", () => {
  it("persists JSON values", () => {
    window.localStorage.clear();
    const { result } = renderHook(() => useLocalStorage("k", 1));
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](4));
    expect(result.current[0]).toBe(4);
    expect(window.localStorage.getItem("k")).toBe("4");
  });
});
