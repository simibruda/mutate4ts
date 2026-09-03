import { describe, expect, it } from "vitest";
import { parseIstanbulCoverage } from "../src/coverage/runner.js";
import { timeoutMillis } from "../src/exec/workers.js";
import { tempDir, writeFile } from "./helpers.js";

describe("coverage and timeouts", () => {
  it("parses Istanbul JSON line coverage", () => {
    const root = tempDir();
    const report = writeFile(root, "coverage/coverage-final.json", JSON.stringify({
      [`${root}/src/flag.ts`]: {
        statementMap: {
          "0": { start: { line: 2 } },
          "1": { start: { line: 5 } }
        },
        s: { "0": 3, "1": 0 },
        l: { "2": 3, "5": 0 }
      }
    }));
    const coverage = parseIstanbulCoverage(report, root);
    expect(coverage.covers("flag.ts", 2)).toBe(true);
    expect(coverage.covers("src/flag.ts", 2)).toBe(true);
    expect(coverage.covers("flag.ts", 5)).toBe(false);
  });

  it("computes mutant timeouts from the baseline duration", () => {
    expect(timeoutMillis(100, 10)).toBe(1000);
    expect(timeoutMillis(250, 10)).toBe(2500);
  });
});
