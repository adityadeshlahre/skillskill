import * as fs from 'fs';
import * as path from 'path';
import { SkillProfile, ScanResult } from './interfaces/config.interface.js';
import { expandHome } from './config.js';

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

export function scanWithProfiles(
  profiles: SkillProfile[],
  globalExclude: string[] = []
): ScanResult[] {
  const results: ScanResult[] = [];

  for (const profile of profiles) {
    for (const rawPath of profile.paths) {
      const root = expandHome(rawPath);
      const hits = listDir(root, {
        exclude: [...globalExclude, ...(profile.exclude ?? [])],
      });
      for (const hit of hits) {
        results.push({
          path: hit,
          size: 0,
          profileId: profile.id,
          modificationTime: 0,
        });
      }
    }
  }

  // Calculate sizes
  for (const result of results) {
    result.size = getFolderSize(result.path);
    try {
      result.modificationTime = fs.statSync(result.path).mtimeMs;
    } catch {
      result.modificationTime = 0;
    }
  }

  // Deduplicate by path, merge profile tags
  const seen = new Map<string, ScanResult>();
  for (const result of results) {
    const existing = seen.get(result.path);
    if (existing) {
      // Keep the first profileId, merge if different
      if (existing.profileId !== result.profileId) {
        existing.profileId = `${existing.profileId},${result.profileId}`;
      }
    } else {
      seen.set(result.path, { ...result });
    }
  }

  return [...seen.values()];
}

function listDir(
  dirPath: string,
  options: { exclude: string[] }
): string[] {
  const results: string[] = [];
  // Include the root directory itself if it exists
  try {
    fs.statSync(dirPath);
    if (!options.exclude.some((pat) => dirPath.includes(pat))) {
      results.push(dirPath);
    }
  } catch {
    return results;
  }
  // Then walk subdirectories
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
