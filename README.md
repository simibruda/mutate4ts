# mutate4ts

`mutate4ts` is a standalone mutation-testing tool for TypeScript and React projects.

It is a port of [mutate4java](https://github.com/unclebob/mutate4java): it targets one source file at a time, discovers mutation sites in that file, runs the package's tests, and reports which mutants were killed, survived, timed out, or were skipped because the target line was uncovered.

It supports `.ts`, `.tsx`, `.js`, and `.jsx` files, including React components.

It also supports differential mutation through an embedded manifest comment at the end of the source file. When a manifest is present, `mutate4ts` can skip unchanged declaration scopes instead of rerunning the entire file.

## What It Does

For a requested TypeScript or React source file, `mutate4ts`:

- runs the owning package's tests with Istanbul/c8 coverage enabled
- fails fast if the unmodified baseline is red
- discovers supported mutation sites from the TypeScript AST, including JSX
- fingerprints declaration scopes for differential mutation
- filters out uncovered mutation sites using `coverage/coverage-final.json`
- applies each covered mutation
- reruns the package tests for each mutant
- prints a differential diagnostics block before running workers
- reports killed and survived mutants in source order
- writes an embedded manifest footer after successful clean runs

Mutation runs can be isolated across multiple worker copies of the package so parallel mutants do not overwrite each other.

## Usage

```bash
npm install -g mutate4ts
# or from this repo:
npm install
npm run build
node dist/cli/main.js src/flag.ts

# Mutate one TypeScript or React source file
mutate4ts src/flag.ts
mutate4ts src/components/Button.tsx

# Print a mutation-site scan without running tests
mutate4ts src/flag.ts --scan

# Write or refresh the embedded manifest without running tests
mutate4ts src/flag.ts --update-manifest

# Reuse existing coverage data instead of refreshing it
mutate4ts src/flag.ts --reuse-coverage

# Restrict mutation to specific lines
mutate4ts src/flag.ts --lines 12,18

# Mutate only scopes changed since the embedded manifest
mutate4ts src/flag.ts --since-last-run

# Ignore the embedded manifest and mutate all covered sites
mutate4ts src/flag.ts --mutate-all

# Warn when the selected mutation count is large
mutate4ts src/flag.ts --mutation-warning 50

# Limit parallel worker count
mutate4ts src/flag.ts --max-workers 4

# Adjust the mutant timeout multiplier
mutate4ts src/flag.ts --timeout-factor 15

# Override the test command
mutate4ts src/flag.ts --test-command "npx vitest run"

# Print live worker progress
mutate4ts src/flag.ts --verbose

# Show usage
mutate4ts --help
```

## Command-Line Options

- `--lines 12,18`
  Restricts mutation to the listed source lines in the requested file.

- `--scan`
  Bypasses baseline, coverage, and mutant execution. It prints every discovered mutation site and marks changed scopes from the embedded manifest with `*`.

- `--update-manifest`
  Rewrites the embedded manifest for the requested file without running baseline tests, coverage, or mutants.

- `--reuse-coverage`
  Reuses the existing Istanbul coverage report instead of refreshing coverage before mutation starts.

- `--since-last-run`
  Restricts mutation to covered sites in declaration scopes that changed since the embedded manifest.

- `--mutate-all`
  Ignores the embedded manifest and runs all covered mutation sites.

- `--mutation-warning N`
  Prints a warning when the selected covered mutation count exceeds `N`. The default is `50`.

- `--max-workers N`
  Caps the number of isolated parallel workers. The default is half the available processors, with a minimum of `1`.

- `--timeout-factor N`
  Sets the timeout multiplier for each mutant test run, relative to the baseline duration. The default is `10`.

- `--test-command CMD`
  Overrides the baseline and mutant test command. When this is set, `mutate4ts` falls back to treating all discovered sites as covered unless external coverage data is already available.

- `--verbose`
  Prints live mutation progress, including worker start and finish lines.

- `--help`
  Prints usage text.

## Targeting Rules

- The tool accepts exactly one `.ts`, `.tsx`, `.js`, or `.jsx` file target.
- Directory-wide mutation is not supported.
- Test sources are executed, but they are not mutation targets.
- `--update-manifest` may not be combined with `--scan`, `--reuse-coverage`, `--lines`, `--since-last-run`, or `--mutate-all`.
- `--lines` may not be combined with `--since-last-run` or `--mutate-all`.
- `--scan` may not be combined with `--since-last-run`, `--mutate-all`, or `--reuse-coverage`.
- `--since-last-run` may not be combined with `--mutate-all`.

## Coverage Filtering

`mutate4ts` generates Istanbul coverage during the baseline run and uses line coverage to skip uncovered mutation sites.

When `--reuse-coverage` is used, the tool skips the coverage refresh and reuses `coverage/coverage-final.json` if it exists. The run prints a warning because covered/uncovered classification may be stale. If the report does not exist, the run continues without coverage filtering.

When `--test-command` is used, the tool does not wrap that custom command in c8. In that mode, mutation sites are treated as covered.

Uncovered sites are reported as:

```text
UNCOVERED path/to/File.ts:42 replace true with false
```

If every discovered site is uncovered, no mutants are executed.

## Parallel Workers

When `--max-workers` is greater than `1`, `mutate4ts` creates isolated worker copies of the owning package under:

```text
.mutate4ts/workers/run-<uuid>/worker-N/
```

Each worker:

- owns its own copied package tree
- mutates only files inside that private copy
- runs tests inside its own workspace
- restores the mutated file before taking the next job
- reuses `node_modules` through a symlink

This avoids collisions in source files, test output, and coverage artifacts.

## Embedded Manifest

On successful clean runs, `mutate4ts` writes an embedded footer comment at the end of the source file. That manifest records:

- manifest version
- module hash
- declaration scopes with stable ids
- start/end lines
- scope semantic hashes

The manifest is stripped before source analysis, so it does not perturb mutation-site positions or scope hashing.

With no explicit selection flags:

- if no manifest exists, `mutate4ts` mutates all covered sites
- if a manifest exists and the module hash is unchanged, it runs zero mutations
- if a manifest exists and the module hash changed, it mutates only sites inside changed scopes

This makes repeated mutation runs cheaper on large files without relying on git.

`--update-manifest` is the manual version of that write step. It refreshes the embedded manifest from the current source analysis even if the package's tests are red, because it does not run them.

`--update-manifest` should not run coverage at all. It is a manifest rewrite only.

## Scan Mode

`--scan` prints a lightweight differential inventory for a single file. It does not:

- run the baseline tests
- generate coverage
- run any mutants
- rewrite the embedded manifest

Typical scan output looks like this:

```text
Scan: 2 mutation sites in src/flag.ts
* src/flag.ts:5 replace true with false
  src/flag.ts:9 replace === with !==
* indicates a scope that differs from the embedded manifest.
```

## Current Mutation Set

The tool currently mutates:

- boolean literals: `true` <-> `false`
- equality and comparison: `==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, `>=`
- arithmetic: `+` <-> `-`, `*` <-> `/` (`+` only for numeric expressions)
- conditional boolean operators: `&&` <-> `||`
- nullish coalescing: `??` -> `||`
- unary operators: `!expr` -> `expr`, `-expr` -> `expr`
- integer constants: `0` <-> `1`
- optional chaining: `obj?.prop` -> `obj.prop`
- ternary branches swapped
- reference-valued rvalues replaced with `null`

React/JSX additions:

- JSX children replaced with `{null}`
- JSX elements returned or assigned replaced with `null`
- shorthand boolean attributes: `hidden` -> `hidden={false}`

Mutation discovery is AST-based, so comments, string literals, generic type arguments, and JSX tag brackets are not treated as mutation sites.

## Output

Typical output looks like this:

```text
Baseline tests passed in 4666 ms.
Total mutation sites: 12
Covered mutation sites: 3
Uncovered mutation sites: 1
Changed mutation sites: 2
Manifest exists: true
Module hash changed: true
Differential surface area: 1
Manifest-violating surface area: 1
WARNING: Found 72 mutations. Consider splitting this module.
KILLED src/flag.ts:5 replace true with false (4686 ms)
UNCOVERED src/flag.ts:12 replace === with !==
Coverage: 1 uncovered sites skipped.
Summary: 1 killed, 0 survived, 1 total.
```

Exit codes:

- `0`: all executed mutants were killed, or there were no covered sites to run
- `1`: command-line usage error
- `2`: baseline tests failed
- `3`: at least one mutant survived

## Build

From the repository root:

```bash
npm install
npm test
npm run build
```

`npm test` runs the unit suite plus a small `node:test` integration run against a temporary sample package.

## Example React app

`examples/pulse-board` is a 20-file React task board with logic, hooks, and UI. Use it to try mutate4ts on real application files:

```bash
cd examples/pulse-board
npm install
npm test
npm run dev

# from the repository root
npx tsx src/cli/main.ts examples/pulse-board/src/components/Badge.tsx --scan
npx tsx src/cli/main.ts examples/pulse-board/src/lib/priority.ts --mutate-all --verbose --max-workers 2 --test-command "npx vitest run"
```

## Workflow Recommendation

If you have a batch of mutation runs to execute in the same package, let the first run generate fresh coverage and then use `--reuse-coverage` for the remaining runs.

```bash
mutate4ts src/first.ts
mutate4ts src/second.ts --reuse-coverage
mutate4ts src/components/Button.tsx --reuse-coverage
```
