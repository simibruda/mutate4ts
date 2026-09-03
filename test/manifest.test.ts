import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ManifestSupport } from "../src/manifest/support.js";
import { MutationCatalog } from "../src/analysis/catalog.js";
import { tempDir, writeFile } from "./helpers.js";

describe("ManifestSupport", () => {
  it("strips, writes, and rereads an embedded manifest", () => {
    const file = writeFile(tempDir(), "src/flag.ts", `
export function on(): boolean {
  return true;
}
`);
    const support = new ManifestSupport();
    const analysis = new MutationCatalog().analyze(file);
    support.write(file, analysis.sourceWithoutManifest, {
      version: 1,
      moduleHash: analysis.moduleHash,
      scopes: analysis.scopes
    });
    const raw = readFileSync(file, "utf8");
    expect(raw).toContain("/* mutate4ts-manifest");
    expect(support.stripManifest(raw).trimEnd()).toBe(analysis.sourceWithoutManifest.trimEnd());
    const parsed = support.read(file);
    expect(parsed?.version).toBe(1);
    expect(parsed?.moduleHash).toBe(analysis.moduleHash);
    expect(parsed?.scopes.map((scope) => scope.id)).toEqual(analysis.scopes.map((scope) => scope.id));
  });
});
