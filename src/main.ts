#!/usr/bin/env node

import { CLIArgs } from './core/interfaces/config.interface.js';
import { loadConfig, resolveConfig } from './core/config.js';
import { scanWithProfiles, totalSize } from './core/scan.js';
import { promptSelection } from './core/selection.js';
import { deleteDir } from './core/delete.js';
import {
  printScanResults,
  printConfirmation,
  printDeletionProgress,
  printSummary,
  formatSize,
  printJSON,
} from './core/display.js';
import * as readline from 'readline';

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  const cli: CLIArgs = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        cli.dryRun = true;
        break;
      case '--delete':
        cli.delete = true;
        break;
      case '--delete-all':
        cli.deleteAll = true;
        break;
      case '--json':
        cli.json = true;
        break;
      case '--root':
        cli.root = args[++i];
        break;
      case '--exclude':
        cli.exclude = [...(cli.exclude ?? []), args[++i]];
        break;
      case '--profile':
        cli.profile = args[++i];
        break;
      case '--disable':
        cli.disable = [...(cli.disable ?? []), args[++i]];
        break;
    }
  }

  return cli;
}

function isCliInvocation(): boolean {
  const arg = process.argv[1];
  return (
    !arg || arg.endsWith('/main.ts') || arg.endsWith('/main.js') || arg.endsWith('/skillskill')
  );
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  if (!isCliInvocation()) return;

  try {
    const cli = parseArgs(process.argv);
    const fileConfig = loadConfig();
    const config = resolveConfig(cli, fileConfig);

    const results = scanWithProfiles(config.profiles, config.exclude, config.explicitRoot ? config.rootDir : undefined);

    if (results.length === 0) {
      console.log('No skill directories found.');
      process.exit(0);
    }

    if (cli.json) {
      printJSON(results, config.profiles, config.rootDir);
      process.exit(0);
    }

    printScanResults(results, config.dryRun);

    let selectedResults = results;

    if (config.deleteAll && !config.dryRun) {
      const confirmed = await askConfirmation('Delete ALL items? Type yes to confirm: ');
      if (!confirmed) {
        console.log('Aborted.');
        process.exit(2);
      }
    } else if (!config.deleteAll) {
      const selectedIndices = await promptSelection(results);

      if (selectedIndices.size === 0) {
        console.log('No items selected.');
        process.exit(0);
      }

      selectedResults = [...selectedIndices]
        .filter((i) => i >= 1 && i <= results.length)
        .map((i) => results[i - 1]);
    }

    if (config.dryRun) {
      console.log(`\nWould delete ${selectedResults.length} item(s) (${formatSize(totalSize(selectedResults))}).`);
      process.exit(0);
    }

    printConfirmation(selectedResults);
    const confirmed = await askConfirmation('Proceed? [y/N] ');
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(2);
    }

    let deleted = 0;
    let failed = 0;
    let freedBytes = 0;

    for (const item of selectedResults) {
      const result = deleteDir(item.path, false);
      printDeletionProgress(result);
      if (result.ok) {
        deleted++;
        freedBytes += item.size;
      } else {
        failed++;
      }
    }

    printSummary(deleted, failed, freedBytes);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
