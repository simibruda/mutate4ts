import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { MutationJob, MutationResult } from "../model.js";
import { ManifestSupport } from "../manifest/support.js";
import type { TestCommandExecutor } from "./process.js";
import type { ProgressReporter } from "../report/formatter.js";
import type { WorkspaceManager } from "./workspace.js";

const manifestSupport = new ManifestSupport();

export class IsolatedMutationWorker {
  constructor(
    private readonly workerModuleRoot: string,
    private readonly executor: TestCommandExecutor,
    private readonly progressReporter: ProgressReporter,
    private readonly workerIndex: number
  ) {}

  async run(job: MutationJob): Promise<MutationResult> {
    this.progressReporter.mutationStarting(this.workerIndex, job);
    const workerFile = path.join(this.workerModuleRoot, job.sourceRelativePath);
    const original = readFileSync(workerFile, "utf8");
    const stripped = manifestSupport.stripManifest(original);
    writeFileSync(workerFile, mutatedSource(stripped, job), "utf8");
    try {
      const run = await this.executor.runTests(this.workerModuleRoot, job.timeoutMillis);
      const result: MutationResult = {
        site: job.site,
        killed: run.exitCode !== 0 || run.timedOut,
        durationMillis: run.durationMillis,
        timedOut: run.timedOut,
        order: job.order,
        totalJobs: job.totalJobs
      };
      this.progressReporter.mutationFinished(this.workerIndex, result);
      return result;
    } finally {
      writeFileSync(workerFile, original, "utf8");
    }
  }
}

function mutatedSource(source: string, job: MutationJob): string {
  return source.slice(0, job.site.start) + job.site.replacementText + source.slice(job.site.end);
}

export class ParallelWorkerPool {
  constructor(
    private readonly workerRoots: string[],
    private readonly executor: TestCommandExecutor,
    private readonly progressReporter: ProgressReporter
  ) {}

  async runAll(jobs: MutationJob[]): Promise<MutationResult[]> {
    this.progressReporter.runStarting(jobs.length, this.workerRoots.length);
    const queue = [...jobs];
    const workers = this.workerRoots.map((workerRoot, index) =>
      this.runWorker(workerRoot, index + 1, queue)
    );
    const nested = await Promise.all(workers);
    return nested.flat().sort((left, right) => left.order - right.order);
  }

  private async runWorker(workerRoot: string, workerIndex: number, queue: MutationJob[]): Promise<MutationResult[]> {
    const worker = new IsolatedMutationWorker(workerRoot, this.executor, this.progressReporter, workerIndex);
    const results: MutationResult[] = [];
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) {
        break;
      }
      results.push(await worker.run(job));
    }
    return results;
  }
}

export async function runMutations(
  moduleRoot: string,
  sites: import("../model.js").MutationSite[],
  timeoutMillis: number,
  maxWorkers: number,
  progressReporter: ProgressReporter,
  testExecutor: TestCommandExecutor,
  workspaceManager: WorkspaceManager
): Promise<MutationResult[]> {
  const jobs = sites.map((site, index) => ({
    site,
    sourceRelativePath: path.relative(moduleRoot, site.file),
    timeoutMillis,
    order: index,
    totalJobs: sites.length
  }));
  const workerCount = Math.max(1, Math.min(jobs.length, maxWorkers));
  const workspaces = workspaceManager.createWorkerWorkspaces(moduleRoot, workerCount);
  try {
    const pool = new ParallelWorkerPool(workspaces.workerRoots, testExecutor, progressReporter);
    return await pool.runAll(jobs);
  } finally {
    workspaces.close();
  }
}

export function timeoutMillis(baselineDurationMillis: number, timeoutFactor: number): number {
  const baseline = Math.max(1, baselineDurationMillis);
  return Math.max(1000, baseline * timeoutFactor);
}
