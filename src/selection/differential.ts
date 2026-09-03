import type {
  ChangedScopes,
  CliArguments,
  DifferentialSelection,
  MutationSite,
  SourceAnalysis
} from "../model.js";
import { allScopeIds } from "../model.js";
import type { ManifestSupport } from "../manifest/support.js";

export class DifferentialSelector {
  constructor(private readonly manifestSupport: ManifestSupport) {}

  select(sourceFile: string, parsed: CliArguments, analysis: SourceAnalysis): DifferentialSelection {
    if (parsed.mutateAll || (!parsed.sinceLastRun && parsed.lines.size > 0)) {
      return notDifferential(analysis);
    }
    const changed = this.changedScopes(sourceFile, analysis);
    if (allScopeIds(changed).size === 0 && !changed.manifestPresent) {
      return notDifferential(analysis);
    }
    const changedIds = allScopeIds(changed);
    const changedMutationSites = mutationCount(analysis, changedIds);
    const differentialSurfaceArea = mutationCount(analysis, changed.unregisteredScopeIds);
    const manifestViolatingSurfaceArea = mutationCount(analysis, changed.manifestViolationScopeIds);
    if (changedIds.size === 0) {
      return {
        selected: [],
        unchangedModule: true,
        manifestExists: changed.manifestPresent,
        moduleHashChanged: changed.moduleHashChanged,
        totalMutationSites: analysis.sites.length,
        changedMutationSites,
        differentialSurfaceArea,
        manifestViolatingSurfaceArea
      };
    }
    return {
      selected: analysis.sites.filter((site) => changedIds.has(site.scopeId)),
      unchangedModule: false,
      manifestExists: changed.manifestPresent,
      moduleHashChanged: changed.moduleHashChanged,
      totalMutationSites: analysis.sites.length,
      changedMutationSites,
      differentialSurfaceArea,
      manifestViolatingSurfaceArea
    };
  }

  changedScopeIds(sourceFile: string, analysis: SourceAnalysis): Set<string> {
    return allScopeIds(this.changedScopes(sourceFile, analysis));
  }

  private changedScopes(sourceFile: string, analysis: SourceAnalysis): ChangedScopes {
    const manifest = this.manifestSupport.read(sourceFile);
    if (!manifest) {
      return {
        manifestPresent: false,
        moduleHashChanged: false,
        unregisteredScopeIds: new Set(),
        manifestViolationScopeIds: new Set()
      };
    }
    if (manifest.moduleHash === analysis.moduleHash) {
      return {
        manifestPresent: true,
        moduleHashChanged: false,
        unregisteredScopeIds: new Set(),
        manifestViolationScopeIds: new Set()
      };
    }
    const previousHashes = new Map(manifest.scopes.map((scope) => [scope.id, scope.semanticHash]));
    const unregisteredScopeIds = new Set<string>();
    const manifestViolationScopeIds = new Set<string>();
    for (const scope of analysis.scopes) {
      const previousHash = previousHashes.get(scope.id);
      if (previousHash === undefined) {
        unregisteredScopeIds.add(scope.id);
      } else if (scope.semanticHash !== previousHash) {
        manifestViolationScopeIds.add(scope.id);
      }
    }
    return {
      manifestPresent: true,
      moduleHashChanged: true,
      unregisteredScopeIds,
      manifestViolationScopeIds
    };
  }
}

function mutationCount(analysis: SourceAnalysis, scopeIds: Set<string>): number {
  return analysis.sites.filter((site) => scopeIds.has(site.scopeId)).length;
}

function notDifferential(analysis: SourceAnalysis): DifferentialSelection {
  return {
    selected: analysis.sites,
    unchangedModule: false,
    manifestExists: false,
    moduleHashChanged: false,
    totalMutationSites: analysis.sites.length,
    changedMutationSites: 0,
    differentialSurfaceArea: 0,
    manifestViolatingSurfaceArea: 0
  };
}

export function filterCovered(
  sites: MutationSite[],
  covers: (sourcePath: string, lineNumber: number) => boolean,
  sourceSuffix: (file: string) => string
): { covered: MutationSite[]; uncovered: MutationSite[] } {
  const covered: MutationSite[] = [];
  const uncovered: MutationSite[] = [];
  for (const site of sites) {
    if (covers(sourceSuffix(site.file), site.lineNumber)) {
      covered.push(site);
    } else {
      uncovered.push(site);
    }
  }
  return { covered, uncovered };
}
