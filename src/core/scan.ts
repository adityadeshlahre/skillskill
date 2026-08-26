import * as fs from 'fs';
import * as path from 'path';
import { SkillProfile, ScanResult } from './interfaces/config.interface.js';
import { expandHome } from './config.js';
import { isProtected } from './delete.js';

export function getFolderSize(dirPath: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          total += getFolderSize(fullPath);
        } else {
          total += fs.statSync(fullPath).size;
        }
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // skip unreadable directories
  }
  return total;
}

export function totalSize(results: ScanResult[]): number {
  return results.reduce((sum, r) => sum + r.size, 0);
}

export function scanWithProfiles(
  profiles: SkillProfile[],
  globalExclude: string[] = [],
  rootOverride?: string
): ScanResult[] {
  const results: ScanResult[] = [];

  for (const profile of profiles) {
    const paths = rootOverride ? [rootOverride] : profile.paths;
    for (const rawPath of paths) {
      const root = expandHome(rawPath);
      if (isProtected(root)) continue;
      const hits = listDir(root, {
        exclude: [...globalExclude, ...(profile.exclude ?? [])],
      });
      for (const hit of hits) {
        const size = getFolderSize(hit);
        results.push({
          path: hit,
          size,
          profileId: profile.id,
        });
      }
    }
  }

  // Deduplicate by path, merge profile tags
  const seen = new Map<string, ScanResult>();
  for (const result of results) {
    const existing = seen.get(result.path);
    if (existing) {
      if (existing.profileId !== result.profileId) {
        existing.profileId = `${existing.profileId},${result.profileId}`;
      }
    } else {
      seen.set(result.path, { ...result });
    }
  }

  return [...seen.values()];
}

function listDir(dirPath: string, options: { exclude: string[] }): string[] {
  const results: string[] = [];
  try {
    fs.statSync(dirPath);
    if (!options.exclude.some((pat) => dirPath.includes(pat))) {
      results.push(dirPath);
    }
  } catch {
    return results;
  }
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (options.exclude.some((pat) => fullPath.includes(pat))) {
        continue;
      }
      if (entry.isDirectory()) {
        results.push(...listDir(fullPath, options));
      }
    }
  } catch {
    // skip unreadable directories
  }
  return results;
}
