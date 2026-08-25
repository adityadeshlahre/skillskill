#!/usr/bin/env node

import { Npkill } from './core/npkill.js';
import { LoggerService } from './core/services/logger.service.js';
import { ScanStatus } from './core/interfaces/search-status.model.js';

// Check if skillskill is called directly from the command line. If so, start the cli. If not, the module is being imported by another module, so don't start.
const shouldStartCli = process.argv[1] === new URL('./main.js', import.meta.url).pathname;
if (shouldStartCli) {
  main();
}

export default async function main() {
  try {
    console.log('SkillSkill - Minimal CLI tool for cleaning skill files');
    console.log('=========================================================\n');
  } catch(e) {
    console.error('Error in main():', e);
    process.exit(1);
  }
}

  // Create default services manually
  const logger = new LoggerService();
  const searchStatus = new ScanStatus();
  
  // Create file service
  const fileService = {
    listDir: async (path, options) => {
      console.log(`Scanning directory: ${path}`);
      console.log(`Targets: ${JSON.stringify(options.targets)}`);
      const fs = await import('fs');
      const matchingFiles = [];
      try {
        const items = fs.readdirSync(path, { withFileTypes: true });
        console.log(`Found ${items.length} items in ${path}`);
        for (const item of items) {
          const fullPath = `${path}/${item.name}`;
          if (exclude.some((pat) => fullPath.includes(pat))) {
            console.log(`  Skipping excluded: ${fullPath}`);
            continue;
          }
          if (targets.some((target) => fullPath.includes(target))) {
            console.log(`  Matched target: ${fullPath}`);
            matchingFiles.push(fullPath);
          }
          if (item.isDirectory()) {
            const subFiles = await scanDirRecursive(fullPath, targets, exclude);
            matchingFiles.push(...subFiles);
          }
        }
      } catch (err) {
        console.error(`Error scanning ${path}:`, err);
      }
      console.log(`Found ${matchingFiles.length} matching files`);
      return matchingFiles;
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
        fs.rmSync(path, { recursive: true, force: true });
        return true;
      } catch {
        return false;
      }
    },
    stopScan: () => {},
    isValidRootFolder: () => ({ isValid: true }),
  };

  const npkill = new Npkill({ logger, searchStatus, fileService });

  // Scan the current directory for skills-related folders
  console.log(`Scanning: ${process.cwd()}\n`);

  const targets = ['**/skills*', '**/skill*', '**/ai*', '**/agent*'];
  const params = {
    targets,
    exclude: [],
    performRiskAnalysis: true,
    sortBy: 'size',
  };

  const results$ = npkill.startScan$(process.cwd(), params);

  // Simple subscription to show results
  results$.subscribe({
    next: (folder) => {
      console.log(`Found: ${folder}`);
    },
    error: (err) => {
      console.error('Error during scan:', err);
    },
    complete: () => {
      console.log('\nScan completed.');
    },
  });
}

// Recursive directory scanner
async function scanDirRecursive(path, targets, exclude) {
  const fs = await import('fs');
  const matchingFiles = [];

  try {
    const items = fs.readdirSync(path, { withFileTypes: true });

    for (const item of items) {
      const fullPath = `${path}/${item.name}`;

      if (exclude.some((pat) => fullPath.includes(pat))) {
        continue;
      }

      if (targets.some((target) => fullPath.includes(target))) {
        matchingFiles.push(fullPath);
      }

      if (item.isDirectory()) {
        const subFiles = await scanDirRecursive(fullPath, targets, exclude);
        matchingFiles.push(...subFiles);
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }

  return matchingFiles;
}