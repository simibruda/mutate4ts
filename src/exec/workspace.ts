import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const SKIP_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".git",
  "coverage",
  "dist",
  "build",
  ".mutate4ts",
  ".next",
  ".turbo",
  ".cache"
]);

export interface WorkerWorkspaces {
  runRoot: string;
  workerRoots: string[];
  close(): void;
}

export interface WorkspaceManager {
  createWorkerWorkspaces(moduleRoot: string, workerCount: number): WorkerWorkspaces;
}

export class CopiedWorkspaceManager implements WorkspaceManager {
  createWorkerWorkspaces(moduleRoot: string, workerCount: number): WorkerWorkspaces {
    const runRoot = path.join(os.tmpdir(), `mutate4ts-workers-${randomUUID()}`);
    mkdirSync(runRoot, { recursive: true });
    const workerRoots: string[] = [];
    for (let worker = 1; worker <= workerCount; worker += 1) {
      const workerRoot = path.join(runRoot, `worker-${worker}`);
      copyModuleTree(moduleRoot, workerRoot);
      workerRoots.push(workerRoot);
    }
    return {
      runRoot,
      workerRoots,
      close() {
        rmSync(runRoot, { recursive: true, force: true });
      }
    };
  }
}

export function copyModuleTree(moduleRoot: string, workerRoot: string): void {
  mkdirSync(workerRoot, { recursive: true });
  copyFiltered(moduleRoot, workerRoot);
  const nodeModules = path.join(moduleRoot, "node_modules");
  if (existsSync(nodeModules)) {
    const target = path.join(workerRoot, "node_modules");
    if (!existsSync(target)) {
      symlinkSync(nodeModules, target, lstatSync(nodeModules).isDirectory() ? "dir" : "file");
    }
  }
}

function copyFiltered(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (SKIP_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyFiltered(from, to);
    } else if (entry.isSymbolicLink()) {
      try {
        symlinkSync(path.resolve(source, entry.name), to);
      } catch {
        cpSync(from, to);
      }
    } else {
      cpSync(from, to);
    }
  }
}
