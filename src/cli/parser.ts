import { availableParallelism } from "node:os";
import type { CliArguments, CliMode } from "../model.js";

export const DEFAULT_TIMEOUT_FACTOR = 10;
export const DEFAULT_MUTATION_WARNING = 50;

export function defaultMaxWorkers(availableProcessors = availableParallelism()): number {
  return Math.max(1, Math.floor(availableProcessors / 2));
}

export interface ParseState {
  help: boolean;
  verbose: boolean;
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
  values: string[];
}

export function emptyParseState(): ParseState {
  return {
    help: false,
    verbose: false,
    lines: new Set(),
    scan: false,
    updateManifest: false,
    reuseCoverage: false,
    sinceLastRun: false,
    mutateAll: false,
    timeoutFactor: DEFAULT_TIMEOUT_FACTOR,
    mutationWarning: DEFAULT_MUTATION_WARNING,
    maxWorkers: defaultMaxWorkers(),
    testCommand: undefined,
    values: []
  };
}

export function toCliArguments(state: ParseState, mode: CliMode): CliArguments {
  return {
    mode,
    fileArgs: [...state.values],
    lines: new Set(state.lines),
    scan: state.scan,
    updateManifest: state.updateManifest,
    reuseCoverage: state.reuseCoverage,
    sinceLastRun: state.sinceLastRun,
    mutateAll: state.mutateAll,
    timeoutFactor: state.timeoutFactor,
    mutationWarning: state.mutationWarning,
    maxWorkers: state.maxWorkers,
    testCommand: state.testCommand,
    verbose: state.verbose
  };
}

export function parsePositiveInt(text: string, flag: string): number {
  const value = Number.parseInt(text, 10);
  if (!Number.isInteger(value) || Number(text) !== value || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

export function parseLines(text: string): Set<number> {
  const lines = new Set<number>();
  for (const part of text.split(",")) {
    if (part.trim() !== "") {
      lines.add(parsePositiveInt(part.trim(), "--lines"));
    }
  }
  if (lines.size === 0) {
    throw new Error("--lines requires at least one line number");
  }
  return lines;
}

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

export function isSourceFile(value: string): boolean {
  const lower = value.toLowerCase();
  return SOURCE_EXTENSIONS.some((extension) => lower.endsWith(extension)) && !lower.endsWith(".d.ts");
}

export function validateSourceFile(values: string[]): void {
  if (values.length === 0) {
    throw new Error("mutate4ts requires exactly one TypeScript or React source file");
  }
  if (values.length !== 1) {
    throw new Error("mutate4ts accepts exactly one TypeScript or React source file");
  }
  if (!isSourceFile(values[0]!)) {
    throw new Error("mutate4ts target must be a .ts, .tsx, .js, or .jsx file");
  }
}

export function validateSelectionFlags(state: ParseState): void {
  reject(state.scan && state.sinceLastRun, "--scan may not be combined with --since-last-run");
  reject(state.scan && state.mutateAll, "--scan may not be combined with --mutate-all");
  reject(state.scan && state.updateManifest, "--scan may not be combined with --update-manifest");
  reject(state.scan && state.reuseCoverage, "--scan may not be combined with --reuse-coverage");
  reject(state.updateManifest && state.sinceLastRun, "--update-manifest may not be combined with --since-last-run");
  reject(state.updateManifest && state.mutateAll, "--update-manifest may not be combined with --mutate-all");
  reject(state.updateManifest && state.lines.size > 0, "--update-manifest may not be combined with --lines");
  reject(state.updateManifest && state.reuseCoverage, "--update-manifest may not be combined with --reuse-coverage");
  reject(state.lines.size > 0 && state.sinceLastRun, "--lines may not be combined with --since-last-run");
  reject(state.lines.size > 0 && state.mutateAll, "--lines may not be combined with --mutate-all");
  reject(state.sinceLastRun && state.mutateAll, "--since-last-run may not be combined with --mutate-all");
}

function reject(invalid: boolean, message: string): void {
  if (invalid) {
    throw new Error(message);
  }
}

export function parseCliArguments(args: string[]): CliArguments {
  const state = emptyParseState();
  for (let i = 0; i < args.length; i += 1) {
    i = parseSwitch(args, i, state);
  }
  if (state.help) {
    return toCliArguments(state, "help");
  }
  validateSelectionFlags(state);
  validateSourceFile(state.values);
  return toCliArguments(state, "explicit-files");
}

function parseSwitch(args: string[], index: number, state: ParseState): number {
  const arg = args[index]!;
  switch (arg) {
    case "--help":
      state.help = true;
      return index;
    case "--verbose":
      state.verbose = true;
      return index;
    case "--scan":
      state.scan = true;
      return index;
    case "--update-manifest":
      state.updateManifest = true;
      return index;
    case "--reuse-coverage":
      state.reuseCoverage = true;
      return index;
    case "--since-last-run":
      state.sinceLastRun = true;
      return index;
    case "--mutate-all":
      state.mutateAll = true;
      return index;
    case "--lines":
      return parseFlagValue(args, index, "--lines", (value) => {
        state.lines = parseLines(value);
      });
    case "--timeout-factor":
      return parseFlagValue(args, index, "--timeout-factor", (value) => {
        state.timeoutFactor = parsePositiveInt(value, "--timeout-factor");
      });
    case "--mutation-warning":
      return parseFlagValue(args, index, "--mutation-warning", (value) => {
        state.mutationWarning = parsePositiveInt(value, "--mutation-warning");
      });
    case "--max-workers":
      return parseFlagValue(args, index, "--max-workers", (value) => {
        state.maxWorkers = parsePositiveInt(value, "--max-workers");
      });
    case "--test-command":
      return parseFlagValue(args, index, "--test-command", (value) => {
        if (value.trim() === "") {
          throw new Error("--test-command must not be blank");
        }
        state.testCommand = value;
      });
    default:
      if (arg.startsWith("--")) {
        throw new Error(`Unknown option: ${arg}`);
      }
      state.values.push(arg);
      return index;
  }
}

function parseFlagValue(args: string[], index: number, flag: string, consumer: (value: string) => void): number {
  const valueIndex = index + 1;
  const value = args[valueIndex];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  consumer(value);
  return valueIndex;
}
