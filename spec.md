# mutate4ts Specification

## 1. Purpose

`mutate4ts` is a mutation-testing tool for TypeScript, JavaScript, and React source code.

It shall:

- accept exactly one `.ts`, `.tsx`, `.js`, or `.jsx` source file as its target
- discover mutation sites in that file from the TypeScript AST, including JSX
- optionally use an embedded manifest to restrict work to changed declaration scopes
- optionally use line coverage to skip uncovered mutation sites
- print differential diagnostics before worker execution
- execute tests against each selected mutant
- report killed, survived, timed-out, and uncovered mutation sites
- update the embedded manifest after successful clean runs

`mutate4ts` is designed for repeated use against a single source file rather than whole-directory or whole-module mutation.

## 2. Scope

This specification defines:

- the command-line contract
- the mutation-site discovery rules
- React/JSX mutation rules
- the manifest format and semantics
- coverage and selection behavior
- worker execution behavior
- report and exit-code behavior

This specification does not define:

- a stable machine-readable output format
- support for whole-directory mutation
- mutation of test sources

## 3. Terminology

- `target file`
  The single TypeScript or React source file passed on the command line.

- `module root`
  The nearest ancestor directory of the target file that contains `package.json`. If no such directory exists, the process working root is the module root.

- `mutation site`
  A concrete source replacement candidate discovered from the TypeScript AST.

- `scope`
  A declaration-level region used for differential mutation. Scopes include functions, methods, constructors, classes, fields, and arrow-function bindings.

- `manifest`
  The embedded footer comment at the end of the target file containing scope hashes.

- `baseline`
  The unmodified test run used to establish pass/fail status and timeout duration.

- `covered site`
  A mutation site whose source line is covered according to Istanbul/c8 line coverage, unless coverage is bypassed by custom test command rules.

## 4. Targeting Rules

The tool shall accept exactly one explicit source file target with one of these extensions:

- `.ts`, `.tsx`, `.mts`, `.cts`
- `.js`, `.jsx`, `.mjs`, `.cjs`

The tool shall reject:

- zero file arguments
- more than one file argument
- directory targets
- `.d.ts` files
- other non-source file targets

The tool shall mutate only the target file.

The tool shall not mutate files under test source roots as targets, even though those tests are executed.

## 5. Command-Line Interface

### 5.1 Supported Forms

The tool shall support these forms:

- `mutate4ts <file>`
- `mutate4ts <file> --scan`
- `mutate4ts <file> --update-manifest`
- `mutate4ts <file> --reuse-coverage`
- `mutate4ts <file> --lines 12,18`
- `mutate4ts <file> --since-last-run`
- `mutate4ts <file> --mutate-all`
- `mutate4ts <file> --mutation-warning N`
- `mutate4ts <file> --max-workers N`
- `mutate4ts <file> --timeout-factor N`
- `mutate4ts <file> --test-command CMD`
- `mutate4ts <file> --verbose`
- `mutate4ts --help`

Options may be combined unless prohibited by the conflict rules below.

### 5.2 Option Semantics

Same as mutate4java, with coverage meaning Istanbul `coverage/coverage-final.json` instead of JaCoCo XML.

### 5.3 Defaults

Unless explicitly overridden:

- timeout factor shall default to `10`
- mutation warning threshold shall default to `50`
- max workers shall default to `max(1, availableParallelism / 2)`
- test command shall default to the package manager's `test` script (`pnpm test`, `yarn test`, `bun test`, or `npm test`)

### 5.4 Option Conflict Rules

The tool shall reject these combinations:

- `--scan` with `--since-last-run`
- `--scan` with `--mutate-all`
- `--scan` with `--update-manifest`
- `--scan` with `--reuse-coverage`
- `--lines` with `--since-last-run`
- `--lines` with `--mutate-all`
- `--lines` with `--update-manifest`
- `--since-last-run` with `--mutate-all`
- `--update-manifest` with `--since-last-run`
- `--update-manifest` with `--mutate-all`
- `--update-manifest` with `--reuse-coverage`

## 6. Source Analysis

Mutation discovery shall be AST-based.

The tool shall parse TypeScript and JSX using the TypeScript compiler API.

The tool shall strip any embedded manifest before:

- source parsing
- mutation discovery
- scope discovery
- scope hashing

### 6.1 Supported Mutation Set

The mutation set shall include:

- boolean literals: `true` <-> `false`
- equality/comparison: `==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, `>=`
- arithmetic: `+` <-> `-`, `*` <-> `/` (`+` only when the expression is numeric, not string concatenation)
- conditional boolean operators: `&&` <-> `||`
- nullish coalescing: `??` -> `||`
- unary operators:
  - `!expr` -> `expr`
  - `-expr` -> `expr`
- integer constants: `0` <-> `1`
- optional chaining: `?.` removed or replaced with `.`
- ternary expressions: swap branches
- reference-valued rvalues replaced with `null`

### 6.2 React / JSX Mutations

When the target is JSX/TSX, the tool shall also discover:

- JSX elements, self-closing elements, and fragments used as children replaced with `{null}`
- JSX elements used as return/assignment rvalues replaced with `null`
- shorthand boolean attributes (`hidden`) replaced with `hidden={false}`
- conditional rendering operators already covered by `&&` / `||` and ternary swaps

### 6.3 Exclusions

The tool shall not treat the following as mutation sites:

- comments
- string literals as operator text
- generic type argument angle brackets
- JSX tag angle brackets as comparison operators
- type-only constructs (interfaces, type aliases, type parameters)
- import/export module specifiers
- embedded manifest content

## 7. Manifest

The manifest shall be stored as an embedded footer comment:

```text
/* mutate4ts-manifest
version=1
moduleHash=...
scope.0.id=...
...
*/
```

Manifest semantics match mutate4java: version, module hash, stable declaration scope ids, start/end lines, and semantic hashes.

The tool shall write the manifest:

- after a successful mutation run with no surviving mutants
- after a successful run with no executed mutants
- when `--update-manifest` is used

The tool shall not write the manifest:

- after a baseline failure
- after any surviving mutant
- during `--scan`

## 8. Differential Selection

When no explicit selection flag is provided:

- if no manifest exists, all covered sites shall be selected
- if a manifest exists and the module hash is unchanged, no sites shall be selected
- if a manifest exists and the module hash changed, only sites in changed scopes shall be selected

`--since-last-run`, `--mutate-all`, and `--lines` follow the mutate4java rules.

## 9. Coverage

By default, the tool shall generate Istanbul coverage during the baseline run using `c8`.

When `--reuse-coverage` is specified, the tool shall not refresh coverage. It shall use `coverage/coverage-final.json` if present, and otherwise continue without coverage filtering.

Coverage shall be interpreted at line granularity.

When `--test-command` is supplied:

- the tool shall not wrap the command in c8 itself
- mutation sites shall be treated as covered unless external coverage data is later added

## 10. Baseline and Test Execution

The default test command is the owning package's test script.

If the baseline fails, mutation shall stop immediately and the process shall exit with status `2`.

`--update-manifest` shall not execute the baseline, generate coverage, or run mutants.

## 11. Worker Model

When `max-workers > 1`, the tool shall create isolated copies of the module under:

```text
.mutate4ts/workers/run-<uuid>/worker-N/
```

Each worker mutates only files inside its private copy, runs tests there, and restores the mutated file between jobs. `node_modules` is reused via symlink.

## 12. Timeout Behavior

Each mutant run shall use a timeout derived from the baseline duration and timeout factor, with a minimum of 1000 ms.

If a mutant times out, it shall be reported as killed and the report shall indicate timeout.

## 13. Reporting

Normal mutation output, scan output, update-manifest output, and the pre-worker diagnostics block shall match mutate4java's report shape.

## 14. Exit Codes

- `0`: all executed mutants were killed, no mutants needed execution, scan succeeded, or manifest update succeeded
- `1`: command-line usage error
- `2`: baseline tests failed
- `3`: at least one mutant survived

## 15. Conformance

An implementation conforms to this specification if it satisfies the command-line, analysis, React/JSX, selection, execution, manifest, reporting, and exit-code rules above for the currently supported mutation set.
