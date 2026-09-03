import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CommandResult, TestRun } from "../model.js";

export interface TestCommandExecutor {
  runTests(projectRoot: string, timeoutMillis: number): Promise<TestRun>;
  withCommand(command: string): TestCommandExecutor;
}

export class ProcessTestCommandExecutor implements TestCommandExecutor {
  constructor(private readonly command = defaultTestCommand) {}

  async runTests(projectRoot: string, timeoutMillis: number): Promise<TestRun> {
    const result = await runProcess(this.command(projectRoot), projectRoot, timeoutMillis);
    return {
      exitCode: result.exitCode,
      output: result.output,
      durationMillis: result.durationMillis,
      timedOut: result.timedOut
    };
  }

  withCommand(command: string): TestCommandExecutor {
    return new ProcessTestCommandExecutor(() => command);
  }
}

export function defaultTestCommand(projectRoot: string): string {
  if (existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) {
    return "pnpm test";
  }
  if (existsSync(path.join(projectRoot, "yarn.lock"))) {
    return "yarn test";
  }
  if (existsSync(path.join(projectRoot, "bun.lockb")) || existsSync(path.join(projectRoot, "bun.lock"))) {
    return "bun test";
  }
  return "npm test";
}

export async function runProcess(command: string, cwd: string, timeoutMillis: number): Promise<CommandResult> {
  const start = Date.now();
  return await new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });
    let timedOut = false;
    const timer = timeoutMillis > 0
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMillis)
      : undefined;
    child.on("close", (code) => {
      if (timer) {
        clearTimeout(timer);
      }
      resolve({
        exitCode: timedOut ? 124 : code ?? 1,
        output,
        durationMillis: Date.now() - start,
        timedOut
      });
    });
  });
}
