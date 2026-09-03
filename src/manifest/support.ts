import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { DifferentialManifest, MutationScope } from "../model.js";

export const MANIFEST_START = "/* mutate4ts-manifest\n";
export const MANIFEST_END = "*/";

export class ManifestSupport {
  read(sourceFile: string): DifferentialManifest | undefined {
    const raw = readFileSync(sourceFile, "utf8");
    const start = this.startIndex(raw);
    if (start < 0) {
      return undefined;
    }
    const end = raw.indexOf(MANIFEST_END, start);
    if (end < 0) {
      return undefined;
    }
    const body = raw.slice(start + MANIFEST_START.length, end).trim();
    return parseManifest(body);
  }

  stripManifest(rawSource: string): string {
    const start = this.startIndex(rawSource);
    if (start < 0) {
      return rawSource;
    }
    return rawSource.slice(0, start).trimEnd() + "\n";
  }

  write(sourceFile: string, sourceWithoutManifest: string, manifest: DifferentialManifest): void {
    const updated = sourceWithoutManifest.trimEnd() + "\n\n" + serializeManifest(manifest);
    writeFileSync(sourceFile, updated, "utf8");
  }

  hashScopes(scopes: MutationScope[]): string {
    const lines = [...scopes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((scope) => `${scope.id}|${scope.semanticHash}`)
      .join("\n");
    return this.hash(lines.length === 0 ? "" : lines + "\n");
  }

  hash(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex");
  }

  private startIndex(raw: string): number {
    const start = raw.lastIndexOf(MANIFEST_START);
    if (start < 0) {
      return -1;
    }
    const tail = raw.slice(start).trimEnd();
    return tail.endsWith(MANIFEST_END) ? start : -1;
  }
}

export class ManifestWriter {
  constructor(private readonly manifestSupport: ManifestSupport) {}

  write(sourceFile: string, analysis: { sourceWithoutManifest: string; moduleHash: string; scopes: MutationScope[] }): void {
    this.manifestSupport.write(sourceFile, analysis.sourceWithoutManifest, {
      version: 1,
      moduleHash: analysis.moduleHash,
      scopes: analysis.scopes
    });
  }
}

export function encodeManifestValue(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function decodeManifestValue(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function serializeManifest(manifest: DifferentialManifest): string {
  const lines = [
    MANIFEST_START.trimEnd(),
    `version=${manifest.version}`,
    `moduleHash=${manifest.moduleHash}`
  ];
  manifest.scopes.forEach((scope, index) => {
    lines.push(`scope.${index}.id=${encodeManifestValue(scope.id)}`);
    lines.push(`scope.${index}.kind=${scope.kind}`);
    lines.push(`scope.${index}.startLine=${scope.startLine}`);
    lines.push(`scope.${index}.endLine=${scope.endLine}`);
    lines.push(`scope.${index}.semanticHash=${scope.semanticHash}`);
  });
  lines.push(MANIFEST_END);
  return lines.join("\n") + "\n";
}

export function parseManifest(body: string): DifferentialManifest {
  const scopes = new Map<number, Record<string, string>>();
  let version = 1;
  let moduleHash = "";
  for (const line of body.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    if (line.startsWith("version=")) {
      version = Number.parseInt(line.slice("version=".length), 10);
    } else if (line.startsWith("moduleHash=")) {
      moduleHash = line.slice("moduleHash=".length);
    } else if (line.startsWith("scope.")) {
      const separator = line.indexOf("=");
      if (separator < 0) {
        continue;
      }
      const key = line.slice(0, separator);
      const parts = key.split(".");
      if (parts.length !== 3) {
        continue;
      }
      const index = Number.parseInt(parts[1]!, 10);
      const current = scopes.get(index) ?? {};
      current[parts[2]!] = line.slice(separator + 1);
      scopes.set(index, current);
    }
  }
  const parsedScopes = [...scopes.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, values]) => ({
      id: decodeManifestValue(values.id ?? ""),
      kind: values.kind ?? "",
      startLine: Number.parseInt(values.startLine ?? "0", 10),
      endLine: Number.parseInt(values.endLine ?? "0", 10),
      semanticHash: values.semanticHash ?? ""
    }));
  return { version, moduleHash, scopes: parsedScopes };
}
