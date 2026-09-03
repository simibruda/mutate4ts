import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectLayout } from "../src/project/layout.js";
import { tempDir, writeFile } from "./helpers.js";

describe("ProjectLayout", () => {
  it("finds package.json above a file even when the file is outside the cwd workspace", () => {
    const project = tempDir();
    writeFile(project, "package.json", "{\"name\":\"outside\"}\n");
    const file = writeFile(project, "src/flag.ts", "export const on = true;\n");
    const layout = new ProjectLayout("/workspace");
    expect(layout.moduleRootFor([file])).toBe(project);
    expect(layout.sourceSuffix(project, file)).toBe("flag.ts");
  });

  it("does not walk above the workspace when the file lives inside it", () => {
    const workspace = tempDir();
    writeFile(workspace, "package.json", "{\"name\":\"root\"}\n");
    const nested = path.join(workspace, "packages", "app");
    writeFile(nested, "package.json", "{\"name\":\"app\"}\n");
    const file = writeFile(nested, "src/flag.ts", "export const on = true;\n");
    const layout = new ProjectLayout(workspace);
    expect(layout.moduleRootFor([file])).toBe(nested);
  });
});
