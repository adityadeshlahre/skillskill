import { NpkillInterface } from './interfaces/npkill.interface.js';
import { ScanStatus } from './interfaces/search-status.model.js';
import { LoggerService } from './services/logger.service.js';

export class Npkill implements NpkillInterface {
  constructor(customServices?: {
    logger?: LoggerService;
    searchStatus?: ScanStatus;
    fileService?: any;
  }) {
    const { logger, searchStatus, fileService } = customServices || {};
    this.logger = logger || new LoggerService();
    this.searchStatus = searchStatus || new ScanStatus();
    this.fileService = fileService || this.createDefaultFileService();
    this.logger.info('SkillSkill started - skills file cleaner');
  }

  createDefaultFileService() {
    const fs = require('fs');
    return {
      listDir: (path: string, options: { exclude: string[]; targets: string[] }) => {
        console.log(`Scanning directory: ${path}`);
        const matchingFiles: string[] = [];
        try {
          const items = fs.readdirSync(path, { withFileTypes: true });
          for (const item of items) {
            const fullPath = `${path}/${item.name}`;
            if (options.exclude.some((pat: string) => fullPath.includes(pat))) {
              continue;
            }
            if (options.targets.some((target: string) => fullPath.includes(target))) {
              matchingFiles.push(fullPath);
            }
            if (item.isDirectory()) {
              matchingFiles.push(...this.createDefaultFileService().listDir(fullPath, options));
            }
          }
        } catch (err) {
          console.error(`Error scanning ${path}:`, err);
        }
        return matchingFiles;
      },
      getFolderSize: (path: string) => {
        try {
          const stats = fs.statSync(path);
          return stats.size;
        } catch {
          return 0;
        }
      },
      deleteDir: (path: string) => {
        try {
          fs.rmSync(path, { recursive: true, force: true });
          return true;
        } catch {
          return false;
        }
      },
      stopScan: () => {},
      isValidRootFolder: (path: string): { isValid: boolean; invalidReason?: string } => {
        try {
          const stat = fs.statSync(path);
          if (!stat.isDirectory()) {
            return { isValid: false, invalidReason: 'The path must point to a directory.' };
          }
          return { isValid: true };
        } catch {
          return { isValid: false, invalidReason: 'The path does not exist.' };
        }
      },
      getVersion: () => '0.0.1',
    };
  }

  logger: LoggerService;
  searchStatus: ScanStatus;
  fileService: any;

  startScan$(
    rootPath: string,
    options: { targets: string[]; exclude: string[]; performRiskAnalysis: boolean; sortBy: string }
  ) {
    this.logger.info(`Scan started in ${rootPath}`);
    return this.fileService.listDir(rootPath, options);
  }

  getSize$(path: string) {
    this.logger.info(`Calculating size for ${path}`);
    return this.fileService.getFolderSize(path);
  }

  delete$(path: string, options: { dryRun?: boolean }) {
    this.logger.info(`Deleting ${path} ${options?.dryRun ? '(dry run)' : ''}...`);
    return this.fileService.deleteDir(path);
  }

  getLogs$() {
    return this.logger.getLogs();
  }

  stopScan() {
    this.logger.info('Stopping scan...');
    this.fileService.stopScan();
  }

  isValidRootFolder(path: string): { isValid: boolean; invalidReason?: string } {
    try {
      const fs = require('fs');
      const stat = fs.statSync(path);
      if (!stat.isDirectory()) {
        return { isValid: false, invalidReason: 'The path must point to a directory.' };
      }
      return { isValid: true };
    } catch {
      return { isValid: false, invalidReason: 'The path does not exist.' };
    }
  }

  getVersion(): string {
    return '0.0.1';
  }
}
