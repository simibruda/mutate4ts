import { availableParallelism } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultMaxWorkers, parseCliArguments } from "../src/cli/parser.js";

describe("parseCliArguments", () => {
  it("rejects a missing file argument", () => {
    expect(() => parseCliArguments([])).toThrow("mutate4ts requires exactly one TypeScript or React source file");
  });

  it("parses a single TypeScript file", () => {
    const parsed = parseCliArguments(["src/flag.ts"]);
    expect(parsed.mode).toBe("explicit-files");
    expect(parsed.fileArgs).toEqual(["src/flag.ts"]);
    expect(parsed.lines.size).toBe(0);
    expect(parsed.scan).toBe(false);
    expect(parsed.updateManifest).toBe(false);
    expect(parsed.reuseCoverage).toBe(false);
    expect(parsed.sinceLastRun).toBe(false);
    expect(parsed.mutateAll).toBe(false);
    expect(parsed.timeoutFactor).toBe(10);
    expect(parsed.mutationWarning).toBe(50);
    expect(parsed.maxWorkers).toBe(defaultMaxWorkers(availableParallelism()));
    expect(parsed.testCommand).toBeUndefined();
    expect(parsed.verbose).toBe(false);
  });

  it("accepts tsx, js, and jsx targets", () => {
    expect(parseCliArguments(["src/Button.tsx"]).fileArgs).toEqual(["src/Button.tsx"]);
    expect(parseCliArguments(["src/flag.js"]).fileArgs).toEqual(["src/flag.js"]);
    expect(parseCliArguments(["src/Button.jsx"]).fileArgs).toEqual(["src/Button.jsx"]);
  });

  it("parses line filters, timeout, workers, and verbose", () => {
    const parsed = parseCliArguments([
      "src/flag.ts", "--lines", "12,18", "--timeout-factor", "15", "--max-workers", "4", "--verbose"
    ]);
    expect(parsed.lines).toEqual(new Set([12, 18]));
    expect(parsed.timeoutFactor).toBe(15);
    expect(parsed.maxWorkers).toBe(4);
    expect(parsed.verbose).toBe(true);
  });

  it("parses scan, update-manifest, reuse-coverage, since-last-run, mutate-all, and test-command", () => {
    expect(parseCliArguments(["src/flag.ts", "--scan"]).scan).toBe(true);
    expect(parseCliArguments(["src/flag.ts", "--update-manifest"]).updateManifest).toBe(true);
    expect(parseCliArguments(["src/flag.ts", "--reuse-coverage"]).reuseCoverage).toBe(true);
    expect(parseCliArguments(["src/flag.ts", "--mutate-all"]).mutateAll).toBe(true);
    const parsed = parseCliArguments([
      "src/flag.ts", "--since-last-run", "--mutation-warning", "75", "--test-command", "npm test -- --run"
    ]);
    expect(parsed.sinceLastRun).toBe(true);
    expect(parsed.mutationWarning).toBe(75);
    expect(parsed.testCommand).toBe("npm test -- --run");
  });

  it("parses help mode", () => {
    expect(parseCliArguments(["--help"]).mode).toBe("help");
  });

  it("rejects invalid combinations and values", () => {
    expect(() => parseCliArguments(["src/flag.ts", "src/other.ts"]))
      .toThrow("mutate4ts accepts exactly one TypeScript or React source file");
    expect(() => parseCliArguments(["README.md"]))
      .toThrow("mutate4ts target must be a .ts, .tsx, .js, or .jsx file");
    expect(() => parseCliArguments(["src/flag.ts", "--timeout-factor", "0"]))
      .toThrow("--timeout-factor must be a positive integer");
    expect(() => parseCliArguments(["src/flag.ts", "--max-workers", "0"]))
      .toThrow("--max-workers must be a positive integer");
    expect(() => parseCliArguments(["src/flag.ts", "--bogus"]))
      .toThrow("Unknown option: --bogus");
    expect(() => parseCliArguments(["src/flag.ts", "--lines", "5", "--since-last-run"]))
      .toThrow("--lines may not be combined with --since-last-run");
    expect(() => parseCliArguments(["src/flag.ts", "--lines", "5", "--mutate-all"]))
      .toThrow("--lines may not be combined with --mutate-all");
    expect(() => parseCliArguments(["src/flag.ts", "--since-last-run", "--mutate-all"]))
      .toThrow("--since-last-run may not be combined with --mutate-all");
    expect(() => parseCliArguments(["src/flag.ts", "--scan", "--since-last-run"]))
      .toThrow("--scan may not be combined with --since-last-run");
    expect(() => parseCliArguments(["src/flag.ts", "--scan", "--update-manifest"]))
      .toThrow("--scan may not be combined with --update-manifest");
    expect(() => parseCliArguments(["src/flag.ts", "--scan", "--reuse-coverage"]))
      .toThrow("--scan may not be combined with --reuse-coverage");
    expect(() => parseCliArguments(["src/flag.ts", "--scan", "--mutate-all"]))
      .toThrow("--scan may not be combined with --mutate-all");
    expect(() => parseCliArguments(["src/flag.ts", "--update-manifest", "--since-last-run"]))
      .toThrow("--update-manifest may not be combined with --since-last-run");
    expect(() => parseCliArguments(["src/flag.ts", "--update-manifest", "--mutate-all"]))
      .toThrow("--update-manifest may not be combined with --mutate-all");
    expect(() => parseCliArguments(["src/flag.ts", "--update-manifest", "--reuse-coverage"]))
      .toThrow("--update-manifest may not be combined with --reuse-coverage");
    expect(() => parseCliArguments(["src/flag.ts", "--update-manifest", "--lines", "5"]))
      .toThrow("--update-manifest may not be combined with --lines");
    expect(() => parseCliArguments(["src/flag.ts", "--lines"]))
      .toThrow("--lines requires a value");
    expect(() => parseCliArguments(["src/flag.ts", "--lines", ",,"]))
      .toThrow("--lines requires at least one line number");
    expect(() => parseCliArguments(["src/flag.ts", "--lines", "a"]))
      .toThrow("--lines must be a positive integer");
    expect(() => parseCliArguments(["src/flag.ts", "--test-command", "   "]))
      .toThrow("--test-command must not be blank");
  });
});
