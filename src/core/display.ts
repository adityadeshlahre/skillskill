import * as os from 'os';
import { ScanResult, SkillProfile } from './interfaces/config.interface.js';
import { totalSize } from './scan.js';
import { DEFAULT_PROFILES } from './constants.js';

const HOME = os.homedir();

export function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function truncatePath(p: string, maxWidth: number): string {
  const display = p.startsWith(HOME) ? `~${p.slice(HOME.length)}` : p;
  if (display.length <= maxWidth) return display;
  return `...${display.slice(display.length - maxWidth + 3)}`;
}

function groupByProfile(results: ScanResult[]): Map<string, ScanResult[]> {
  const groups = new Map<string, ScanResult[]>();
  for (const r of results) {
    const key = r.profileId.split(',')[0];
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.size - a.size);
  }
  return groups;
}

function getProfileName(id: string): string {
  return DEFAULT_PROFILES.find((p) => p.id === id)?.name ?? id;
}

export interface RenderState {
  results: ScanResult[];
  selected: Set<number>;
  cursor: number;
  scrollOffset: number;
  mode: 'scan' | 'select' | 'confirm' | 'deleting' | 'done';
  dryRun: boolean;
  deleted: number;
  failed: number;
  freedBytes: number;
}

function buildFlatList(results: ScanResult[]): { index: number; item: ScanResult; group: string }[] {
  const groups = groupByProfile(results);
  const flat: { index: number; item: ScanResult; group: string }[] = [];
  let idx = 1;
  for (const [groupId, items] of groups) {
    for (const item of items) {
      flat.push({ index: idx, item, group: groupId });
      idx++;
    }
  }
  return flat;
}

function countGroups(results: ScanResult[]): number {
  const groups = new Set<string>();
  for (const r of results) groups.add(r.profileId.split(',')[0]);
  return groups.size;
}

export function render(state: RenderState): void {
  const write = process.stdout.write.bind(process.stdout);
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const pathWidth = cols - 14;

  write('\x1b[2J\x1b[H');

  const title = state.dryRun ? 'SkillSkill — DRY RUN' : 'SkillSkill';
  write(`\x1b[1m${title}\x1b[0m\r\n`);
  write('\r\n');

  const flat = buildFlatList(state.results);
  const maxVisible = rows - 6;
  const groups = groupByProfile(state.results);

  let displayed = 0;
  let globalIdx = 0;

  for (const [groupId, items] of groups) {
    if (displayed >= maxVisible) break;

    const name = getProfileName(groupId);
    const subtotal = formatSize(totalSize(items));
    write(`\x1b[36m=== ${name} (${items.length} items, ${subtotal}) ===\x1b[0m\r\n`);
    displayed++;

    for (const item of items) {
      if (displayed >= maxVisible) break;
      globalIdx++;

      const isSelected = state.selected.has(globalIdx);
      const isCursor = state.cursor === globalIdx && state.mode === 'select';

      const num = String(globalIdx).padStart(2, ' ');
      const size = formatSize(item.size).padStart(6, ' ');
      const displayPath = truncatePath(item.path, pathWidth);

      let line: string;
      if (state.mode === 'scan' || state.mode === 'done') {
        line = `${num}. ${size}  ${displayPath}`;
      } else if (isCursor && isSelected) {
        line = `${num}. ${size}  \x1b[7m\x1b[32m ✔ \x1b[0m ${displayPath}`;
      } else if (isCursor) {
        line = `${num}. ${size}  \x1b[7m   \x1b[0m ${displayPath}`;
      } else if (isSelected) {
        line = `${num}. ${size}  \x1b[32m ✔ \x1b[0m ${displayPath}`;
      } else {
        line = `${num}. ${size}    ${displayPath}`;
      }

      write(`${line}\r\n`);
      displayed++;
    }
    write('\r\n');
  }

  const total = formatSize(totalSize(state.results));
  write(`\x1b[1mTotal: ${state.results.length} items, ${total}\x1b[0m\r\n`);
  write('\r\n');

  if (state.mode === 'select') {
    const selCount = state.selected.size;
    write(`\x1b[2m[↑↓] move  [SPACE] select  [a] all  [ENTER] confirm  [q] quit\x1b[0m`);
    if (selCount > 0) {
      write(`  \x1b[32m${selCount} selected\x1b[0m`);
    }
    write('\r\n');
  } else if (state.mode === 'confirm') {
    write(`\x1b[33mDelete ${state.selected.size} item(s)? [y/N]\x1b[0m\r\n`);
  } else if (state.mode === 'deleting') {
    write(`\x1b[33mDeleting...\x1b[0m\r\n`);
  } else if (state.mode === 'done') {
    if (state.failed > 0) {
      write(`\x1b[32mDeleted ${state.deleted} items, freed ${formatSize(state.freedBytes)}.\x1b[0m \x1b[31m${state.failed} failed.\x1b[0m\r\n`);
    } else if (state.deleted > 0) {
      write(`\x1b[32mDeleted ${state.deleted} items, freed ${formatSize(state.freedBytes)}.\x1b[0m\r\n`);
    }
  }
}

export function printScanResults(results: ScanResult[], dryRun: boolean): void {
  const state: RenderState = {
    results,
    selected: new Set(),
    cursor: 1,
    scrollOffset: 0,
    mode: 'scan',
    dryRun,
    deleted: 0,
    failed: 0,
    freedBytes: 0,
  };
  render(state);
}

export function printConfirmation(items: ScanResult[]): void {
  const size = totalSize(items);
  console.log(`\nWill delete ${items.length} item(s) (${formatSize(size)}):`);
  for (const item of items) {
    console.log(`  ${item.path} (${formatSize(item.size)})`);
  }
  console.log('');
}

export function printDeletionProgress(result: { ok: boolean; path: string; error?: string }): void {
  if (result.ok) {
    console.log(`  \u2713 deleted ${result.path}`);
  } else {
    console.log(`  \u2717 FAILED ${result.path} \u2014 ${result.error ?? 'unknown error'}`);
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

export function printJSON(results: ScanResult[], profiles: SkillProfile[], rootDir: string): void {
  const profilesOutput: Record<string, {
    name: string;
    items: Array<{ path: string; sizeBytes: number; profileId: string }>;
    totalSizeBytes: number;
    count: number;
  }> = {};
  let totalSizeBytes = 0;

  for (const profile of profiles) {
    const items = results.filter((r) => r.profileId.includes(profile.id));
    const size = totalSize(items);
    totalSizeBytes += size;
    profilesOutput[profile.id] = {
      name: profile.name,
      items: items.map((r) => ({
        path: r.path,
        sizeBytes: r.size,
        profileId: r.profileId,
      })),
      totalSizeBytes: size,
      count: items.length,
    };
  }

  console.log(JSON.stringify({
    root: rootDir,
    scanDate: new Date().toISOString(),
    profiles: profilesOutput,
    totalItems: results.length,
    totalSizeBytes,
  }, null, 2));
}
