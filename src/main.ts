#!/usr/bin/env node

import { CLIArgs } from './core/interfaces/config.interface.js';
import { loadConfig, resolveConfig } from './core/config.js';
import { scanWithProfiles, totalSize } from './core/scan.js';
import { deleteDir } from './core/delete.js';
import { TuiRenderer, printJSON, formatSize } from './core/display.js';
import pc from 'picocolors';

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  const cli: CLIArgs = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': cli.dryRun = true; break;
      case '--delete': cli.delete = true; break;
      case '--delete-all': cli.deleteAll = true; break;
      case '--json': cli.json = true; break;
      case '--root': cli.root = args[++i]; break;
      case '--exclude': cli.exclude = [...(cli.exclude ?? []), args[++i]]; break;
      case '--profile': cli.profile = args[++i]; break;
      case '--disable': cli.disable = [...(cli.disable ?? []), args[++i]]; break;
    }
  }
  return cli;
}

function isCliInvocation(): boolean {
  const arg = process.argv[1];
  return !arg || arg.endsWith('/main.ts') || arg.endsWith('/main.js') || arg.endsWith('/skillskill');
}

async function main() {
  if (!isCliInvocation()) return;

  try {
    const cli = parseArgs(process.argv);
    const fileConfig = loadConfig();
    const config = resolveConfig(cli, fileConfig);

    const results = scanWithProfiles(
      config.profiles,
      config.exclude,
      config.explicitRoot ? config.rootDir : undefined
    );

    if (results.length === 0) {
      console.log('No skill directories found.');
      process.exit(0);
    }

    if (cli.json) {
      printJSON(results, config.profiles, config.rootDir);
      process.exit(0);
    }

    if (config.deleteAll && !config.dryRun) {
      const rl = (await import('readline')).createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const answer = await new Promise<string>((resolve) => {
        rl.question(pc.yellow('Delete ALL items? Type yes to confirm: '), (a) => {
          rl.close();
          resolve(a.trim());
        });
      });
      if (answer !== 'yes') {
        console.log('Aborted.');
        process.exit(2);
      }
      performDeletion(results, config.dryRun);
      return;
    }

    const tui = new TuiRenderer(results, config.dryRun);
    process.stdout.write('\x1b[?25l');
    tui.render();

    await new Promise<void>((resolve) => {
      tui.startListening((key, ctrl) => {
        if (ctrl && key === 'c') {
          tui.exit();
          process.exit(0);
        }

        switch (key) {
          case 'up':
          case 'k':
            tui.moveCursor(-1);
            break;
          case 'down':
          case 'j':
            tui.moveCursor(1);
            break;
          case 'pageup':
          case 'u':
            tui.moveCursorPage(-1);
            break;
          case 'pagedown':
          case 'd':
            tui.moveCursorPage(1);
            break;
          case 'home':
            tui.moveCursorFirst();
            break;
          case 'end':
            tui.moveCursorLast();
            break;
          case 'space':
          case 'delete':
            tui.toggleSelect();
            break;
          case 'a':
            tui.toggleSelectAll();
            break;
          case 'return':
          case 'enter': {
            const selected = tui.getSelectedResults();
            if (selected.length === 0) break;
            tui.exit();
            if (config.dryRun) {
              console.log(`\nWould delete ${selected.length} item(s) (${formatSize(totalSize(selected))}).`);
              resolve();
              return;
            }
            confirmAndDelete(selected, tui, resolve);
            return;
          }
          case 'q':
            tui.exit();
            resolve();
            return;
        }

        tui.render();
      });
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

function confirmAndDelete(
  items: import('./core/interfaces/config.interface.js').ScanResult[],
  tui: TuiRenderer,
  resolve: () => void
): void {
  const rl = (require('readline') as typeof import('readline')).createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\nWill delete ${items.length} item(s) (${formatSize(totalSize(items))}):`);
  for (const item of items) {
    console.log(`  ${item.path} (${formatSize(item.size)})`);
  }
  console.log('');

  rl.question(pc.yellow('Proceed? [y/N] '), (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') {
      console.log('Aborted.');
      resolve();
      return;
    }

    let deleted = 0;
    let failed = 0;
    let freedBytes = 0;

    for (const item of items) {
      const result = deleteDir(item.path, false);
      if (result.ok) {
        deleted++;
        freedBytes += item.size;
        console.log(`  \u2713 deleted ${item.path}`);
      } else {
        failed++;
        console.log(`  \u2717 FAILED ${item.path} — ${result.error ?? 'unknown error'}`);
      }
    }

    console.log('');
    if (failed > 0) {
      console.log(`Deleted ${deleted} items, freed ${formatSize(freedBytes)}. ${failed} failed.`);
    } else {
      console.log(`Deleted ${deleted} items, freed ${formatSize(freedBytes)}.`);
    }
    resolve();
  });
}

function performDeletion(
  items: import('./core/interfaces/config.interface.js').ScanResult[],
  dryRun: boolean
): void {
  if (dryRun) {
    console.log(`\nWould delete ${items.length} item(s) (${formatSize(totalSize(items))}).`);
    return;
  }

  let deleted = 0;
  let failed = 0;
  let freedBytes = 0;

  for (const item of items) {
    const result = deleteDir(item.path, false);
    if (result.ok) {
      deleted++;
      freedBytes += item.size;
      console.log(`  \u2713 deleted ${item.path}`);
    } else {
      failed++;
      console.log(`  \u2717 FAILED ${item.path} — ${result.error ?? 'unknown error'}`);
    }
  }

  console.log('');
  if (failed > 0) {
    console.log(`Deleted ${deleted} items, freed ${formatSize(freedBytes)}. ${failed} failed.`);
  } else {
    console.log(`Deleted ${deleted} items, freed ${formatSize(freedBytes)}.`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
