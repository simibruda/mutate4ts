import type { MutationJob, MutationResult, MutationSite, TestRun } from "../model.js";
import { posixRelative } from "../project/layout.js";

export interface ProgressReporter {
  baselineStarting(moduleRoot: string): void;
  baselineFinished(baseline: TestRun): void;
  runStarting(totalMutations: number, workerCount: number): void;
  mutationStarting(workerIndex: number, job: MutationJob): void;
  mutationFinished(workerIndex: number, result: MutationResult): void;
}

export class NoOpProgressReporter implements ProgressReporter {
  baselineStarting(): void {}
  baselineFinished(): void {}
  runStarting(): void {}
  mutationStarting(): void {}
  mutationFinished(): void {}
}

export class PrintStreamProgressReporter implements ProgressReporter {
  constructor(private readonly out: NodeJS.WritableStream) {}

  baselineStarting(moduleRoot: string): void {
    this.out.write(`Baseline starting for ${moduleRoot}\n`);
  }

  baselineFinished(baseline: TestRun): void {
    this.out.write(`Baseline finished: exit=${baseline.exitCode} timedOut=${baseline.timedOut} duration=${baseline.durationMillis} ms\n`);
  }

  runStarting(totalMutations: number, workerCount: number): void {
    this.out.write(`Running ${totalMutations} mutations with ${workerCount} workers.\n`);
  }

  mutationStarting(workerIndex: number, job: MutationJob): void {
    this.out.write(
      `Worker ${workerIndex} starting ${job.order + 1}/${job.totalJobs}: ${job.site.file}:${job.site.lineNumber} ${job.site.description}\n`
    );
  }

  mutationFinished(workerIndex: number, result: MutationResult): void {
    this.out.write(
      `Worker ${workerIndex} finished ${result.order + 1}/${result.totalJobs}: ${result.killed ? "KILLED" : "SURVIVED"} ${result.site.file}:${result.site.lineNumber}\n`
    );
  }
}

export function formatReport(
  projectRoot: string,
  baseline: TestRun,
  extra: string,
  uncovered: MutationSite[],
  results: MutationResult[]
): string {
  let out = `Baseline tests passed in ${baseline.durationMillis} ms.\n`;
  if (extra.trim() !== "") {
    out += extra;
  }
  for (const site of uncovered) {
    out += `UNCOVERED ${posixRelative(projectRoot, site.file)}:${site.lineNumber} ${site.description}\n`;
  }
  for (const result of results) {
    out += `${result.killed ? "KILLED" : "SURVIVED"} ${posixRelative(projectRoot, result.site.file)}:${result.site.lineNumber} ${result.site.description} (${result.durationMillis} ms)\n`;
    if (result.timedOut) {
      out += "  timed out\n";
    }
  }
  const killed = results.filter((result) => result.killed).length;
  out += `Coverage: ${uncovered.length} uncovered sites skipped.\n`;
  out += `Summary: ${killed} killed, ${results.length - killed} survived, ${results.length} total.\n`;
  return out;
}
