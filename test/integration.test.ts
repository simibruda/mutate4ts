import { describe, expect, it } from "vitest";
import { run } from "../src/cli/main.js";
import { captureStream, tempDir, writeFile } from "./helpers.js";

describe("end-to-end mutation against node:test", () => {
  it("kills mutants in a small JavaScript module", async () => {
    const root = tempDir();
    writeFile(root, "package.json", JSON.stringify({
      name: "sample",
      type: "module",
      scripts: { test: "node --test" }
    }, null, 2));
    writeFile(root, "src/flag.js", `
export function isOn(value) {
  return value === true;
}
`);
    writeFile(root, "src/flag.test.js", `
import assert from "node:assert/strict";
import { test } from "node:test";
import { isOn } from "./flag.js";

test("true is on", () => {
  assert.equal(isOn(true), true);
});

test("false is off", () => {
  assert.equal(isOn(false), false);
});
`);
    const out = captureStream();
    const err = captureStream();
    const code = await run(
      ["src/flag.js", "--mutate-all", "--max-workers", "1", "--test-command", "node --test"],
      root,
      out.stream,
      err.stream
    );
    expect(code, err.text() + out.text()).toBe(0);
    expect(out.text()).toContain("KILLED ");
    expect(out.text()).toContain("Summary:");
    expect(out.text()).not.toContain("SURVIVED ");
  }, 60_000);

  it("scans a React component without running tests", async () => {
    const root = tempDir();
    writeFile(root, "package.json", "{\"name\":\"react-sample\"}\n");
    writeFile(root, "src/Banner.tsx", `
export function Banner({ show }: { show: boolean }) {
  return show ? <strong>Hello</strong> : null;
}
`);
    const out = captureStream();
    const code = await run(["src/Banner.tsx", "--scan"], root, out.stream, captureStream().stream);
    expect(code).toBe(0);
    expect(out.text()).toContain("Scan:");
    expect(out.text()).toContain("swap ternary branches");
    expect(out.text()).toContain("replace <strong>Hello</strong> with null");
  });
});
