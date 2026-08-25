#!/usr/bin/env node

import { Npkill } from './core/npkill.js';
import { createDefaultServices } from './core/services/index.js';
import { fileURLToPath } from 'url';

const shouldStartCli = process.argv[1] === new URL('./main.js', import.meta.url).pathname;
if (shouldStartCli) {
  main();
}

export default async function main() {
  console.log('SkillSkill - Minimal CLI tool for cleaning skill files');
  console.log('=========================================================\n');

  // Create default services
  const logger = new (await import('./core/services/logger.service.js')).LoggerService();
  const searchStatus = new (await import('./core/interfaces/search-status.model.js')).ScanStatus();
  const defaultServices = createDefaultServices(searchStatus, logger);
  const npkill = new Npkill({ logger, searchStatus, ...defaultServices });

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