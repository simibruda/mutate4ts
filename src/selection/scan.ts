import type { MutationSite } from "../model.js";
import { posixRelative } from "../project/layout.js";

export function filterByLines(sites: MutationSite[], lines: Set<number>): MutationSite[] {
  if (lines.size === 0) {
    return sites;
  }
  return sites.filter((site) => lines.has(site.lineNumber));
}

export function formatScanReport(
  workspaceRoot: string,
  sourceFile: string,
  sites: MutationSite[],
  changedScopes: Set<string>
): string {
  const lines = [`Scan: ${sites.length} mutation sites in ${posixRelative(workspaceRoot, sourceFile)}`];
  for (const site of sites) {
    const marker = changedScopes.has(site.scopeId) ? "* " : "  ";
    lines.push(`${marker}${posixRelative(workspaceRoot, site.file)}:${site.lineNumber} ${site.description}`);
  }
  if (changedScopes.size > 0) {
    lines.push("* indicates a scope that differs from the embedded manifest.");
  }
  return lines.join("\n") + "\n";
}
