import { existsSync, statSync } from "node:fs";
import path from "node:path";

const MODULE_MARKERS = ["package.json", "pnpm-workspace.yaml"];

export class ProjectLayout {
  constructor(private readonly workspaceRoot: string) {}

  explicitFile(arg: string): string {
    const resolved = path.resolve(this.workspaceRoot, arg);
    if (existsSync(resolved) && statSync(resolved).isDirectory()) {
      throw new Error("mutate4ts target must be a .ts, .tsx, .js, or .jsx file");
    }
    return resolved;
  }

  moduleRootFor(files: string[]): string {
    return this.findModuleRoot(files[0]!) ?? this.workspaceRoot;
  }

  sourceSuffix(moduleRoot: string, file: string): string {
    return normalizeSourcePath(moduleRoot, file);
  }

  private findModuleRoot(file: string): string | undefined {
    let current = existsSync(file) && statSync(file).isDirectory() ? file : path.dirname(file);
    const fileIsInsideWorkspace = current === this.workspaceRoot || current.startsWith(this.workspaceRoot + path.sep);
    while (true) {
      if (MODULE_MARKERS.some((marker) => existsSync(path.join(current, marker)))) {
        return current;
      }
      if (fileIsInsideWorkspace && current === this.workspaceRoot) {
        break;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
    return undefined;
  }
}

export function normalizeSourcePath(moduleRoot: string, file: string): string {
  const relative = path.relative(moduleRoot, file).replaceAll("\\", "/");
  const prefixes = ["src/main/ts/", "src/main/js/", "src/test/ts/", "src/test/js/", "src/", "app/", "lib/", "source/"];
  for (const prefix of prefixes) {
    if (relative.startsWith(prefix)) {
      return relative.slice(prefix.length);
    }
  }
  return relative;
}

export function posixRelative(from: string, to: string): string {
  return path.relative(from, to).replaceAll("\\", "/");
}
