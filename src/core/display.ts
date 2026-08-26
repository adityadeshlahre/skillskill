import * as os from 'os';
import { ScanResult } from './interfaces/config.interface.js';

export function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function truncatePath(p: string, maxWidth: number): string {
  const home = os.homedir();
  const display = p.startsWith(home) ? `~${p.slice(home.length)}` : p;
  if (display.length <= maxWidth) return display;
  return `...${display.slice(display.length - maxWidth + 3)}`;
}

function groupByProfile(results: ScanResult[]): Map<string, ScanResult[]> {
  const groups = new Map<string, ScanResult[]>();
  for (const r of results) {
    const key = r.profileId.split(',')[0]; // use first profile for grouping
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  // Sort within each group: largest first
  for (const group of groups.values()) {
    group.sort((a, b) => b.size - a.size);
  }
  return groups;
}

export function printScanResults(results: ScanResult[], dryRun: boolean): void {
  const terminalWidth = process.stdout.columns ?? 80;
  const pathWidth = terminalWidth - 12; // "NN.  SSS UNIT  " = ~12 chars

  const groups = groupByProfile(results);
  let globalIndex = 1;

  const profileNames: Record<string, string> = {
    opencode: 'OpenCode',
    claude: 'Claude Code',
    cursor: 'Cursor',
  };

  console.log('');
  if (dryRun) {
    console.log('SkillSkill — DRY RUN (no files will be deleted)');
  } else {
    console.log(`SkillSkill — scanning ${process.env.HOME}`);
  }
  console.log('');

  for (const [profileId, items] of groups) {
    const totalSize = items.reduce((sum, r) => sum + r.size, 0);
    const name = profileNames[profileId] ?? profileId;
    console.log(`=== ${name} (${items.length} items, ${formatSize(totalSize)}) ===`);

    for (const item of items) {
      const num = String(globalIndex).padStart(2, ' ');
      const size = formatSize(item.size).padStart(6, ' ');
      const displayPath = truncatePath(item.path, pathWidth);
      console.log(`${num}. ${size}  ${displayPath}`);
      globalIndex++;
    }
    console.log('');
  }

  const totalItems = results.length;
  const totalSize = results.reduce((sum, r) => sum + r.size, 0);
  console.log(`Total: ${totalItems} items, ${formatSize(totalSize)}`);
  console.log('');
}

export function printConfirmation(
  items: ScanResult[],
  allResults: ScanResult[]
): void {
  const totalSize = items.reduce((sum, r) => sum + r.size, 0);
  console.log(`Will delete ${items.length} item(s) (${formatSize(totalSize)}):`);
  for (const item of items) {
    console.log(`  ${item.path} (${formatSize(item.size)})`);
  }
  console.log('');
}

export function printDeletionProgress(result: { ok: boolean; path: string; error?: string }): void {
  if (result.ok) {
    console.log(`  ✓ deleted ${result.path}`);
  } else {
    console.log(`  ✗ FAILED ${result.path} — ${result.error ?? 'unknown error'}`);
  }
}

export function printSummary(deleted: number, failed: number, freedBytes: number): void {
  console.log('');
  if (failed > 0) {
    console.log(`Deleted ${deleted} items, freed ${formatSize(freedBytes)}. ${failed} failed.`);
  } else {
    console.log(`Deleted ${deleted} items, freed ${formatSize(freedBytes)}.`);
  }
}
