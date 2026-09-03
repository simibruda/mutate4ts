export type CliMode = "explicit-files" | "help";

export interface CliArguments {
  mode: CliMode;
  fileArgs: string[];
  lines: Set<number>;
  scan: boolean;
  updateManifest: boolean;
  reuseCoverage: boolean;
  sinceLastRun: boolean;
  mutateAll: boolean;
  timeoutFactor: number;
  mutationWarning: number;
  maxWorkers: number;
  testCommand: string | undefined;
  verbose: boolean;
}

export interface MutationSite {
  file: string;
  lineNumber: number;
  start: number;
  end: number;
  originalText: string;
  replacementText: string;
  description: string;
  scopeId: string;
  scopeKind: string;
  scopeStartLine: number;
  scopeEndLine: number;
}

export interface MutationScope {
  id: string;
  kind: string;
  startLine: number;
  endLine: number;
  semanticHash: string;
}

export interface ScopeRef {
  id: string;
  kind: string;
  startLine: number;
  endLine: number;
}

export interface SourceAnalysis {
  sourceWithoutManifest: string;
  sites: MutationSite[];
  scopes: MutationScope[];
  moduleHash: string;
}

export interface DifferentialManifest {
  version: number;
  moduleHash: string;
  scopes: MutationScope[];
}

export interface TestRun {
  exitCode: number;
  output: string;
  durationMillis: number;
  timedOut: boolean;
}

export interface MutationJob {
  site: MutationSite;
  sourceRelativePath: string;
  timeoutMillis: number;
  order: number;
  totalJobs: number;
}

export interface MutationResult {
  site: MutationSite;
  killed: boolean;
  durationMillis: number;
  timedOut: boolean;
  order: number;
  totalJobs: number;
}

export interface CoverageSite {
  sourcePath: string;
  lineNumber: number;
}

export interface CoverageReport {
  covers(sourcePath: string, lineNumber: number): boolean;
}

export interface CoverageRun {
  baseline: TestRun;
  report: CoverageReport;
  reused: boolean;
  reportAvailable: boolean;
}

export interface DifferentialSelection {
  selected: MutationSite[];
  unchangedModule: boolean;
  manifestExists: boolean;
  moduleHashChanged: boolean;
  totalMutationSites: number;
  changedMutationSites: number;
  differentialSurfaceArea: number;
  manifestViolatingSurfaceArea: number;
}

export interface CoverageSelection {
  covered: MutationSite[];
  uncovered: MutationSite[];
}

export interface ChangedScopes {
  manifestPresent: boolean;
  moduleHashChanged: boolean;
  unregisteredScopeIds: Set<string>;
  manifestViolationScopeIds: Set<string>;
}

export interface MutantResultSummary {
  sourceFile: string;
  baseline: TestRun;
  extra: string;
  uncovered: MutationSite[];
  results: MutationResult[];
}

export interface CommandResult {
  exitCode: number;
  output: string;
  durationMillis: number;
  timedOut: boolean;
}

export function testRunPassed(run: TestRun): boolean {
  return run.exitCode === 0 && !run.timedOut;
}

export function allScopeIds(changed: ChangedScopes): Set<string> {
  return new Set([...changed.unregisteredScopeIds, ...changed.manifestViolationScopeIds]);
}

export function coverageReportFrom(coveredLines: Iterable<CoverageSite>, treatAllAsCovered = false): CoverageReport {
  const keys = new Set(
    [...coveredLines].map((site) => coverageKey(site.sourcePath, site.lineNumber))
  );
  return {
    covers(sourcePath: string, lineNumber: number): boolean {
      if (treatAllAsCovered) {
        return true;
      }
      const normalized = sourcePath.replaceAll("\\", "/");
      if (keys.has(coverageKey(normalized, lineNumber))) {
        return true;
      }
      for (const key of keys) {
        const separator = key.lastIndexOf(":");
        const path = key.slice(0, separator);
        const line = Number(key.slice(separator + 1));
        if (line === lineNumber && (path === normalized || path.endsWith("/" + normalized) || normalized.endsWith("/" + path))) {
          return true;
        }
      }
      return false;
    }
  };
}

export function allCoveredReport(): CoverageReport {
  return coverageReportFrom([], true);
}

export function coverageKey(sourcePath: string, lineNumber: number): string {
  return `${sourcePath.replaceAll("\\", "/")}:${lineNumber}`;
}
