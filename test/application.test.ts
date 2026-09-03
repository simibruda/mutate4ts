import { availableParallelism } from "node:os";
import { describe, expect, it } from "vitest";
import { coverageReportFrom, type CoverageReport, type TestRun } from "../src/model.js";
import { run, usage, exitIfNeeded } from "../src/cli/main.js";
import { CliApplication } from "../src/engine/execution.js";
import { parseCliArguments } from "../src/cli/parser.js";
import { CoverageRunner } from "../src/coverage/runner.js";
import type { CoverageRun } from "../src/model.js";
import type { TestCommandExecutor } from "../src/exec/process.js";
import { CopiedWorkspaceManager } from "../src/exec/workspace.js";
import { PrintStreamProgressReporter } from "../src/report/formatter.js";
import { ManifestSupport } from "../src/manifest/support.js";
import { captureStream, tempDir, writeFile } from "./helpers.js";

const SAMPLE = `export function truthy(): boolean {
  return true;
}

export function same(left: number, right: number): boolean {
  return left == right;
}
`;

class StubExecutor implements TestCommandExecutor {
  invocations = 0;

  constructor(private readonly mutantRun: TestRun = { exitCode: 1, output: "killed", durationMillis: 5, timedOut: false }) {}

  async runTests(): Promise<TestRun> {
    this.invocations += 1;
    return this.mutantRun;
  }

  withCommand(): TestCommandExecutor {
    return this;
  }
}

class StubCoverageRunner extends CoverageRunner {
  invocations = 0;

  constructor(
    private readonly report: CoverageReport,
    private readonly baseline: TestRun = { exitCode: 0, output: "", durationMillis: 10, timedOut: false }
  ) {
    super();
  }

  override async generateCoverage(): Promise<CoverageRun> {
    this.invocations += 1;
    return {
      baseline: this.baseline,
      report: this.report,
      reused: false,
      reportAvailable: true
    };
  }
}

function application(
  root: string,
  out: NodeJS.WritableStream,
  err: NodeJS.WritableStream,
  executor: StubExecutor,
  coverage: StubCoverageRunner,
  verbose = new PrintStreamProgressReporter(out)
): CliApplication {
  return new CliApplication(root, out, err, executor, coverage, new CopiedWorkspaceManager(), verbose);
}

describe("CLI application", () => {
  it("does not exit when the code is zero", () => {
    let code = -1;
    exitIfNeeded(0, (value) => {
      code = value;
    });
    expect(code).toBe(-1);
  });

  it("exits when the code is non-zero", () => {
    let code = -1;
    exitIfNeeded(3, (value) => {
      code = value;
    });
    expect(code).toBe(3);
  });

  it("prints help and exits zero", async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await run(["--help"], tempDir(), out.stream, err.stream, new StubExecutor());
    expect(code).toBe(0);
    expect(out.text()).toContain("Usage:");
    expect(usage()).toContain("mutate4ts");
  });

  it("scans mutation sites without running coverage or mutants", async () => {
    const root = tempDir();
    writeFile(root, "package.json", "{\"name\":\"sample\"}\n");
    const file = writeFile(root, "src/sample.ts", SAMPLE);
    const coverage = new StubCoverageRunner(coverageReportFrom([]));
    const executor = new StubExecutor();
    const out = captureStream();
    const relative = "src/sample.ts";
    const code = await application(root, out.stream, captureStream().stream, executor, coverage)
      .execute(parseCliArguments([relative, "--scan"]));
    expect(code).toBe(0);
    expect(out.text()).toContain("Scan: ");
    expect(out.text()).toContain("src/sample.ts:");
    expect(out.text()).toContain("replace true with false");
    expect(out.text()).toContain("replace == with !=");
    expect(executor.invocations).toBe(0);
    expect(coverage.invocations).toBe(0);
    expect(new ManifestSupport().stripManifest(await import("node:fs").then((fs) => fs.readFileSync(file, "utf8"))).trim()).toBe(SAMPLE.trim());
  });

  it("updates the manifest without running coverage or mutants", async () => {
    const root = tempDir();
    writeFile(root, "package.json", "{\"name\":\"sample\"}\n");
    const file = writeFile(root, "src/sample.ts", SAMPLE);
    const coverage = new StubCoverageRunner(coverageReportFrom([]));
    const executor = new StubExecutor();
    const out = captureStream();
    const code = await application(root, out.stream, captureStream().stream, executor, coverage)
      .execute(parseCliArguments(["src/sample.ts", "--update-manifest"]));
    expect(code).toBe(0);
    expect(out.text()).toContain("Updated manifest for src/sample.ts");
    expect(executor.invocations).toBe(0);
    expect(coverage.invocations).toBe(0);
    expect(new ManifestSupport().read(file)).toBeDefined();
  });

  it("reports killed mutants and writes a manifest", async () => {
    const root = tempDir();
    writeFile(root, "package.json", "{\"name\":\"sample\"}\n");
    writeFile(root, "src/sample.ts", SAMPLE);
    const coverage = new StubCoverageRunner(coverageReportFrom([
      { sourcePath: "sample.ts", lineNumber: 2 },
      { sourcePath: "sample.ts", lineNumber: 6 }
    ]));
    const executor = new StubExecutor();
    const out = captureStream();
    const code = await application(root, out.stream, captureStream().stream, executor, coverage)
      .execute(parseCliArguments(["src/sample.ts", "--mutate-all", "--max-workers", "1"]));
    expect(code).toBe(0);
    expect(out.text()).toContain("Baseline tests passed in 10 ms.");
    expect(out.text()).toContain("KILLED ");
    expect(out.text()).toContain("Summary:");
    expect(new ManifestSupport().read(`${root}/src/sample.ts`.replace("//", "/"))).toBeDefined();
  });

  it("reports surviving mutants with exit code 3", async () => {
    const root = tempDir();
    writeFile(root, "package.json", "{\"name\":\"sample\"}\n");
    writeFile(root, "src/sample.ts", SAMPLE);
    const coverage = new StubCoverageRunner(coverageReportFrom([
      { sourcePath: "sample.ts", lineNumber: 2 }
    ]));
    const executor = new StubExecutor({ exitCode: 0, output: "survived", durationMillis: 4, timedOut: false });
    const out = captureStream();
    const code = await application(root, out.stream, captureStream().stream, executor, coverage)
      .execute(parseCliArguments(["src/sample.ts", "--mutate-all", "--max-workers", "1"]));
    expect(code).toBe(3);
    expect(out.text()).toContain("SURVIVED ");
  });

  it("fails fast when the baseline is red", async () => {
    const root = tempDir();
    writeFile(root, "package.json", "{\"name\":\"sample\"}\n");
    writeFile(root, "src/sample.ts", SAMPLE);
    const coverage = new StubCoverageRunner(
      coverageReportFrom([]),
      { exitCode: 1, output: "boom", durationMillis: 3, timedOut: false }
    );
    const err = captureStream();
    const code = await application(root, captureStream().stream, err.stream, new StubExecutor(), coverage)
      .execute(parseCliArguments(["src/sample.ts", "--mutate-all"]));
    expect(code).toBe(2);
    expect(err.text()).toContain("Baseline tests failed.");
    expect(err.text()).toContain("boom");
  });

  it("prints verbose worker progress", async () => {
    const root = tempDir();
    writeFile(root, "package.json", "{\"name\":\"sample\"}\n");
    writeFile(root, "src/sample.ts", SAMPLE);
    const coverage = new StubCoverageRunner(coverageReportFrom([
      { sourcePath: "sample.ts", lineNumber: 2 }
    ]));
    const progress = captureStream();
    const code = await application(
      root,
      captureStream().stream,
      captureStream().stream,
      new StubExecutor(),
      coverage,
      new PrintStreamProgressReporter(progress.stream)
    ).execute(parseCliArguments(["src/sample.ts", "--mutate-all", "--verbose", "--max-workers", "1"]));
    expect(code).toBe(0);
    expect(progress.text()).toContain("Baseline starting for");
    expect(progress.text()).toContain("Baseline finished: exit=0 timedOut=false duration=10 ms");
    expect(progress.text()).toContain("Running ");
    expect(progress.text()).toContain("Worker 1 starting");
    expect(progress.text()).toContain("Worker 1 finished");
  });

  it("uses max(1, availableProcessors / 2) as the default worker count", () => {
    expect(parseCliArguments(["src/flag.ts"]).maxWorkers).toBe(Math.max(1, Math.floor(availableParallelism() / 2)));
  });
});
