import type { CliArguments, CoverageRun, CoverageSelection, DifferentialSelection, MutantResultSummary, SourceAnalysis, TestRun } from "../model.js";
import { MutationCatalog } from "../analysis/catalog.js";
import { ManifestSupport, ManifestWriter } from "../manifest/support.js";
import { ProjectLayout, posixRelative } from "../project/layout.js";
import { DifferentialSelector, filterCovered } from "../selection/differential.js";
import { filterByLines, formatScanReport } from "../selection/scan.js";
import { formatReport, NoOpProgressReporter, PrintStreamProgressReporter, type ProgressReporter } from "../report/formatter.js";
import { CoverageRunner, baselineFailure, runBaseline } from "../coverage/runner.js";
import { runMutations, timeoutMillis } from "../exec/workers.js";
import type { TestCommandExecutor } from "../exec/process.js";
import { CopiedWorkspaceManager, type WorkspaceManager } from "../exec/workspace.js";

export interface ExecutionContext {
  sourceFile: string;
  moduleRoot: string;
  executor: TestCommandExecutor;
  progressReporter: ProgressReporter;
  analysis: SourceAnalysis;
}

export function createExecutionContext(
  parsed: CliArguments,
  executor: TestCommandExecutor,
  verboseProgressReporter: ProgressReporter,
  layout: ProjectLayout,
  catalog: MutationCatalog
): ExecutionContext {
  const selectedExecutor = parsed.testCommand ? executor.withCommand(parsed.testCommand) : executor;
  const sourceFile = layout.explicitFile(parsed.fileArgs[0]!);
  return {
    sourceFile,
    moduleRoot: layout.moduleRootFor([sourceFile]),
    executor: selectedExecutor,
    progressReporter: parsed.verbose ? verboseProgressReporter : new NoOpProgressReporter(),
    analysis: catalog.analyze(sourceFile)
  };
}

export class CliExecution {
  private readonly catalog = new MutationCatalog();
  private readonly manifestSupport = new ManifestSupport();
  private readonly selector: DifferentialSelector;
  private readonly manifestWriter: ManifestWriter;

  constructor(
    private readonly workspaceRoot: string,
    private readonly out: NodeJS.WritableStream,
    private readonly err: NodeJS.WritableStream,
    private readonly testExecutor: TestCommandExecutor,
    private readonly coverageRunner: CoverageRunner,
    private readonly verboseProgressReporter: ProgressReporter,
    private readonly layout: ProjectLayout,
    private readonly workspaceManager: WorkspaceManager
  ) {
    this.selector = new DifferentialSelector(this.manifestSupport);
    this.manifestWriter = new ManifestWriter(this.manifestSupport);
  }

  async execute(parsed: CliArguments): Promise<number> {
    const context = createExecutionContext(
      parsed,
      this.testExecutor,
      this.verboseProgressReporter,
      this.layout,
      this.catalog
    );
    if (parsed.scan) {
      const sites = filterByLines(context.analysis.sites, parsed.lines);
      const changed = this.selector.changedScopeIds(context.sourceFile, context.analysis);
      this.out.write(formatScanReport(this.workspaceRoot, context.sourceFile, sites, changed));
      return 0;
    }
    if (parsed.updateManifest) {
      this.manifestWriter.write(context.sourceFile, context.analysis);
      this.out.write(`Updated manifest for ${posixRelative(this.workspaceRoot, context.sourceFile)}\n`);
      return 0;
    }

    const coverageRun = await runBaseline(
      parsed,
      context.executor,
      context.moduleRoot,
      this.coverageRunner,
      this.err,
      context.progressReporter
    );
    if (coverageRun.baseline.exitCode !== 0 || coverageRun.baseline.timedOut) {
      return baselineFailure(coverageRun.baseline, this.err);
    }

    const summary = await this.runMutants(parsed, context, coverageRun.baseline, coverageRun);
    return this.writeOutcome(summary, context.analysis);
  }

  private async runMutants(
    parsed: CliArguments,
    context: ExecutionContext,
    baseline: TestRun,
    coverageRun: CoverageRun
  ): Promise<MutantResultSummary> {
    const differential = this.selector.select(context.sourceFile, parsed, context.analysis);
    const discovered = filterByLines(differential.selected, parsed.lines);
    const coverageSelection = filterCovered(
      discovered,
      (sourcePath, lineNumber) => coverageRun.report.covers(sourcePath, lineNumber),
      (file) => this.layout.sourceSuffix(context.moduleRoot, file)
    );
    const extra = extraText(parsed, differential, coverageSelection);
    if (coverageSelection.covered.length === 0) {
      return {
        sourceFile: context.sourceFile,
        baseline,
        extra,
        uncovered: coverageSelection.uncovered,
        results: []
      };
    }
    const results = await runMutations(
      context.moduleRoot,
      coverageSelection.covered,
      timeoutMillis(baseline.durationMillis, parsed.timeoutFactor),
      parsed.maxWorkers,
      context.progressReporter,
      context.executor,
      this.workspaceManager
    );
    return {
      sourceFile: context.sourceFile,
      baseline,
      extra,
      uncovered: coverageSelection.uncovered,
      results
    };
  }

  private writeOutcome(summary: MutantResultSummary, analysis: SourceAnalysis): number {
    if (summary.results.length === 0) {
      this.manifestWriter.write(summary.sourceFile, analysis);
      this.out.write(formatReport(this.workspaceRoot, summary.baseline, summary.extra, summary.uncovered, []));
      return 0;
    }
    const exit = summary.results.some((result) => !result.killed) ? 3 : 0;
    if (exit === 0) {
      this.manifestWriter.write(summary.sourceFile, analysis);
    }
    this.out.write(formatReport(this.workspaceRoot, summary.baseline, summary.extra, summary.uncovered, summary.results));
    return exit;
  }
}

export function extraText(
  parsed: CliArguments,
  differential: DifferentialSelection,
  coverageSelection: CoverageSelection
): string {
  let extra = "";
  extra += `Total mutation sites: ${differential.totalMutationSites}\n`;
  extra += `Covered mutation sites: ${coverageSelection.covered.length}\n`;
  extra += `Uncovered mutation sites: ${coverageSelection.uncovered.length}\n`;
  extra += `Changed mutation sites: ${differential.changedMutationSites}\n`;
  extra += `Manifest exists: ${differential.manifestExists}\n`;
  extra += `Module hash changed: ${differential.moduleHashChanged}\n`;
  extra += `Differential surface area: ${differential.differentialSurfaceArea}\n`;
  extra += `Manifest-violating surface area: ${differential.manifestViolatingSurfaceArea}\n`;
  if (differential.unchangedModule) {
    extra += "No mutations need testing.\n";
  }
  if (coverageSelection.covered.length > parsed.mutationWarning) {
    extra += `WARNING: Found ${coverageSelection.covered.length} mutations. Consider splitting this module.\n`;
  }
  return extra;
}

export class CliApplication {
  private readonly layout: ProjectLayout;
  private readonly execution: CliExecution;

  constructor(
    workspaceRoot: string,
    out: NodeJS.WritableStream,
    err: NodeJS.WritableStream,
    executor: TestCommandExecutor,
    coverageRunner: CoverageRunner = new CoverageRunner(),
    workspaceManager: WorkspaceManager = new CopiedWorkspaceManager(),
    verboseProgressReporter: ProgressReporter = new PrintStreamProgressReporter(out)
  ) {
    this.layout = new ProjectLayout(workspaceRoot);
    this.execution = new CliExecution(
      workspaceRoot,
      out,
      err,
      executor,
      coverageRunner,
      verboseProgressReporter,
      this.layout,
      workspaceManager
    );
  }

  execute(parsed: CliArguments): Promise<number> {
    return this.execution.execute(parsed);
  }

  sourceSuffix(moduleRoot: string, file: string): string {
    return this.layout.sourceSuffix(moduleRoot, file);
  }

  moduleRootFor(files: string[]): string {
    return this.layout.moduleRootFor(files);
  }
}
