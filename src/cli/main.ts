#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseCliArguments } from "./parser.js";
import { usageText } from "./usage.js";
import { CliApplication } from "../engine/execution.js";
import { ProcessTestCommandExecutor, type TestCommandExecutor } from "../exec/process.js";

export function usage(): string {
  return usageText;
}

export function exitIfNeeded(exit: number, exiter: (code: number) => void): void {
  if (exit !== 0) {
    exiter(exit);
  }
}

export async function run(
  args: string[],
  projectRoot = path.resolve("."),
  out: NodeJS.WritableStream = process.stdout,
  err: NodeJS.WritableStream = process.stderr,
  executor: TestCommandExecutor = new ProcessTestCommandExecutor()
): Promise<number> {
  try {
    const parsed = parseCliArguments(args);
    if (parsed.mode === "help") {
      out.write(usage());
      return 0;
    }
    return await new CliApplication(projectRoot, out, err, executor).execute(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    err.write(message + "\n");
    out.write(usage());
    return 1;
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  const code = await run(process.argv.slice(2));
  exitIfNeeded(code, (exit) => process.exit(exit));
}
