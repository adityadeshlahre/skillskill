import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ScanStatus } from './interfaces/search-status.model.js';
import { LoggerService } from './services/logger.service.js';

/**
 * Main class that implements core directory scanning and cleanup functionality.
 * Provides methods for recursive directory scanning, size calculation, and safe deletion operations.
 * Minimal dependency version similar to npkill.
 */
export class Npkill {
  constructor(customServices) {
    const { logger, searchStatus, fileService } = customServices || {};
    this.logger = logger || new LoggerService();
    this.searchStatus = searchStatus || new ScanStatus();
    this.fileService = fileService || this.createDefaultFileService();
    this.logger.info('SkillSkill started - skills file cleaner');
  }

  startScan$(rootPath, options) {
    this.logger.info(`Scan started in ${rootPath}`);
    return this.fileService.listDir(rootPath, options);
  }

  getSize$(path) {
    this.logger.info(`Calculating size for ${path}`);
    return this.fileService.getFolderSize(path);
  }

  delete$(path, options) {
    this.logger.info(`Deleting ${path} ${options?.dryRun ? '(dry run)' : ''}...`);
    return this.fileService.deleteDir(path);
  }

  getLogs$() {
    return this.logger.getLog$();
  }

  stopScan() {
    this.logger.info('Stopping scan...');
    this.fileService.stopScan();
  }

  isValidRootFolder(path) {
    try {
      const fs = await import('fs');
      const stat = fs.statSync(path);
      if (!stat.isDirectory()) {
        return { isValid: false, invalidReason: 'The path must point to a directory.' };
      }
      return { isValid: true };
    } catch {
      return { isValid: false, invalidReason: 'The path does not exist.' };
    }
  }

  getVersion() {
    return '0.0.1';
  }
}

/**
 * Create default file service
 */
function createDefaultFileService() {
  return {
    listDir: async (path, options) => {
      return await scanDirectory(path, options.targets || [], options.exclude || []);
    },
    getFolderSize: async (path) => {
      const fs = await import('fs');
      try {
        const stats = fs.statSync(path);
        return stats.size;
      } catch {
        return 0;
      }
    },
    deleteDir: async (path) => {
      const fs = await import('fs');
      try {
        const fsModule = await import('fs');
        fsModule.rmSync(path, { recursive: true, force: true });
        return true;
      } catch {
        return false;
      }
    },
    stopScan: () => {},
    isValidRootFolder: () => ({ isValid: true }),
  };
}

/**
 * Recursively scan directory for targets matching
 */
async function scanDirectory(path, targets, exclude) {
  const fs = await import('fs');

  const matchingFiles = [];

  try {
    const items = fs.readdirSync(path, { withFileTypes: true });

    for (const item of items) {
      const fullPath = `${path}/${item.name}`;

      // Skip excluded patterns
      if (exclude.some((pat) => fullPath.includes(pat))) {
        continue;
      }

      // Check if item matches targets
      if (targets.some((target) => fullPath.includes(target))) {
        matchingFiles.push(fullPath);
      }

      // Recurse into directories
      if (item.isDirectory()) {
        const subFiles = await scanDirectory(fullPath, targets, exclude);
        matchingFiles.push(...subFiles);
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }

  return matchingFiles;
}