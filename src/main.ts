#!/usr/bin/env node

import * as readline from 'readline';
import { Npkill } from './core/npkill.js';
import { LoggerService } from './core/services/logger.service.js';
import { ScanStatus } from './core/interfaces/search-status.model.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const shouldStartCli = process.argv[1] === './src/main.ts' || process.argv[1] === './main.ts';
if (shouldStartCli) {
  main();
}

export default async function main() {
  try {
    console.log('SkillSkill - Minimal CLI tool for cleaning skill files');
    console.log('=========================================================\n');
  } catch (e) {
    console.error('Error in main():', e);
    process.exit(1);
  }

  const logger = new LoggerService();
  const searchStatus = new ScanStatus();

  const npkill = new Npkill({ logger, searchStatus });

  const targets = ['**/skills*', '**/skill*', '**/ai*', '**/agent*'];
  const params = {
    targets,
    exclude: [],
    performRiskAnalysis: true,
    sortBy: 'size',
  };

  console.log(`Scanning: ${process.cwd()}\n`);

  const results: string[] = [];
  npkill.startScan$(process.cwd(), params).forEach((folder: string) => results.push(folder));

  if (results.length === 0) {
    console.log('No skill-related folders found.');
    process.exit(0);
  }

  console.log(`Found ${results.length} skill-related folder(s):\n`);

  for (let i = 0; i < results.length; i++) {
    const size = npkill.getSize$(results[i]);
    console.log(`${i + 1}. ${results[i]} (size: ${size} bytes)`);
  }

  console.log(`\n${results.length + 1}. Cancel`);

  const selectedIndices: number[] = [];

  for (let i = 0; i < results.length; i++) {
    await ask(`Select folder ${i + 1} to delete? (y/n): `);
  }

  const input = await ask(
    `Select folders to delete (comma-separated numbers, or "all" to delete everything, "cancel" to abort): `
  );

  rl.close();
}

function ask(question: string): Promise<void> {
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      resolve();
    });
  });
}
