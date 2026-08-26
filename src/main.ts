#!/usr/bin/env node

import * as readline from 'readline';
import { CLIArgs } from './core/interfaces/config.interface.js';
import { loadConfig, resolveConfig } from './core/config.js';
import { scanWithProfiles, totalSize } from './core/scan.js';
import { parseSelection } from './core/selection.js';
import { deleteDir } from './core/delete.js';
import {
  printScanResults,
  printConfirmation,
  printDeletionProgress,
  printSummary,
  formatSize,
  printJSON,
} from './core/display.js';

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function cleanup() {
  rl.close();
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

function isCliInvocation(): boolean {
  const arg = process.argv[1];
  return (
    !arg || arg.endsWith('/main.ts') || arg.endsWith('/main.js') || arg.endsWith('/skillskill')
  );
}

async function main() {
  if (!isCliInvocation()) return;

  try {
    const cli = parseArgs(process.argv);
    const fileConfig = loadConfig();
    const config = resolveConfig(cli, fileConfig);

    // Scan (--root overrides profile paths)
    const results = scanWithProfiles(config.profiles, config.exclude, config.rootDir);

    if (results.length === 0) {
      console.log('No skill directories found.');
      cleanup();
      process.exit(0);
    }

    // JSON output mode
    if (cli.json) {
      printJSON(results, config.profiles, config.rootDir);
      cleanup();
      process.exit(0);
    }

    // Display
    printScanResults(results, config.dryRun);

    // Handle --delete-all
    let selectedResults = results;
    if (config.deleteAll && !config.dryRun) {
      printConfirmation(selectedResults);
      const confirm = await ask('Delete ALL items? Type yes to confirm: ');
      if (confirm !== 'yes') {
        console.log('Aborted.');
        cleanup();
        process.exit(2);
      }
    } else if (!config.deleteAll) {
      // Interactive selection
      let selectionInput = '';
      while (!selectionInput) {
        selectionInput = await ask('Select items to delete (e.g. 1,3,5-8,a,q): ');
      }

      const selection = parseSelection(selectionInput);

      if (selection.quit) {
        cleanup();
        process.exit(0);
      }

      if (selection.all) {
        selectedResults = results;
      } else if (selection.indices.size > 0) {
        selectedResults = [...selection.indices]
          .filter((i) => i >= 1 && i <= results.length)
          .map((i) => results[i - 1]);
      } else {
        console.log('No valid items selected.');
        cleanup();
        process.exit(2);
      }
    }

    // Dry-run: print summary and exit
    if (config.dryRun) {
      console.log(
        `\nWould delete ${selectedResults.length} item(s) (${formatSize(totalSize(selectedResults))}).`
      );
      cleanup();
      process.exit(0);
    }

    // Confirmation
    printConfirmation(selectedResults);
    const confirm = await ask('Proceed? [y/N] ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Aborted.');
      cleanup();
      process.exit(2);
    }

    // Delete
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
    cleanup();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error:', err);
    cleanup();
    process.exit(1);
  }
}

main();
