import * as fs from 'fs';
import { DeleteResult } from './interfaces/config.interface.js';
import { PROTECTED_PATHS } from './constants.js';

export function isProtected(targetPath: string): boolean {
  try {
    const resolved = fs.realpathSync(targetPath);
    return PROTECTED_PATHS.some(
      (protectedPath) => resolved === protectedPath || resolved.startsWith(protectedPath + '/')
    );
  } catch {
    return false;
  }
}

export function deleteDir(targetPath: string, dryRun: boolean = false): DeleteResult {
  if (isProtected(targetPath)) {
    return { ok: false, path: targetPath, error: 'protected path', dryRun };
  }

  if (dryRun) {
    return { ok: true, path: targetPath, dryRun: true };
  }

  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return { ok: true, path: targetPath };
  } catch (err) {
    return {
      ok: false,
      path: targetPath,
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}
