import * as os from 'os';
import * as readline from 'readline';
import ansiEscapes from 'ansi-escapes';
import pc from 'picocolors';
import { ScanResult, SkillProfile } from './interfaces/config.interface.js';
import { totalSize } from './scan.js';
import { DEFAULT_PROFILES } from './constants.js';

const HOME = os.homedir();
const MARGINS = { ROW_RESULTS_START: 5, FOLDER_COLUMN_START: 1 };

export function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function getProfileName(id: string): string {
  return DEFAULT_PROFILES.find((p) => p.id === id)?.name ?? id;
}

function groupByProfile(results: ScanResult[]): Map<string, ScanResult[]> {
  const groups = new Map<string, ScanResult[]>();
  for (const r of results) {
    const key = r.profileId.split(',')[0];
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  for (const group of groups.values()) group.sort((a, b) => b.size - a.size);
  return groups;
}

interface FlatItem {
  globalIndex: number;
  item: ScanResult;
  group: string;
  isGroupHeader: boolean;
}

function buildFlatList(results: ScanResult[]): FlatItem[] {
  const groups = groupByProfile(results);
  const flat: FlatItem[] = [];
  let idx = 0;
  for (const [groupId, items] of groups) {
    flat.push({ globalIndex: -1, item: items[0], group: groupId, isGroupHeader: true });
    for (const item of items) {
      idx++;
      flat.push({ globalIndex: idx, item, group: groupId, isGroupHeader: false });
    }
  }
  return flat;
}

function shortenText(text: string, width: number): string {
  if (text.length <= width) return text;
  return text.substring(0, width - 3) + '...';
}

function countSelectableBefore(flatList: FlatItem[], index: number): number {
  let count = 0;
  for (let i = 0; i < index; i++) {
    if (!flatList[i].isGroupHeader) count++;
  }
  return count;
}

function selectableAtIndex(flatList: FlatItem[], selectNum: number): FlatItem | null {
  let count = 0;
  for (const item of flatList) {
    if (item.isGroupHeader) continue;
    count++;
    if (count === selectNum) return item;
  }
  return null;
}

function totalSelectable(flatList: FlatItem[]): number {
  let count = 0;
  for (const item of flatList) if (!item.isGroupHeader) count++;
  return count;
}

export interface TuiState {
  results: ScanResult[];
  flatList: FlatItem[];
  selected: Set<number>;
  cursorIndex: number;
  scroll: number;
  mode: 'select' | 'confirm' | 'deleting' | 'done' | 'idle';
  dryRun: boolean;
  deleted: number;
  failed: number;
  freedBytes: number;
  selectMode: boolean;
}

export class TuiRenderer {
  private state: TuiState;
  private onKeyCallback: ((key: string, ctrl: boolean) => void) | null = null;
  private stdinRestore: (() => void) | null = null;
  private renderedRowCount = 0;

  constructor(results: ScanResult[], dryRun: boolean) {
    this.state = {
      results,
      flatList: buildFlatList(results),
      selected: new Set(),
      cursorIndex: 1,
      scroll: 0,
      mode: 'select',
      dryRun,
      deleted: 0,
      failed: 0,
      freedBytes: 0,
      selectMode: true,
    };
  }

  startListening(onKey: (key: string, ctrl: boolean) => void): void {
    this.onKeyCallback = onKey;
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    const handler = (_: unknown, key: { name: string; sequence: string; ctrl: boolean }) => {
      if (key.name !== '') this.onKeyCallback?.(key.name, key.ctrl);
    };
    process.stdin.on('keypress', handler);

    this.stdinRestore = () => {
      process.stdin.removeListener('keypress', handler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    };
  }

  stopListening(): void {
    this.stdinRestore?.();
    this.stdinRestore = null;
  }

  private get terminal() {
    return { columns: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 };
  }

  private get maxVisible(): number {
    return this.terminal.rows - MARGINS.ROW_RESULTS_START - 2;
  }

  private out(text: string): void {
    process.stdout.write(text);
  }

  private outAt(text: string, x: number, y: number): void {
    process.stdout.write(ansiEscapes.cursorTo(x, y));
    process.stdout.write(text);
  }

  private clearRow(row: number): void {
    process.stdout.write(ansiEscapes.cursorTo(0, row));
    process.stdout.write(ansiEscapes.eraseLine);
  }

  render(): void {
    const { columns } = this.terminal;
    const pathWidth = columns - 16;
    const total = totalSelectable(this.state.flatList);
    const scrollMax = Math.max(0, total - this.maxVisible);

    this.out(ansiEscapes.clearTerminal);

    const title = this.state.dryRun ? pc.bold('SkillSkill — DRY RUN') : pc.bold('SkillSkill');
    this.out(title + '\r\n');

    if (this.state.selectMode) {
      const sel = `${this.state.selected.size} selected `;
      const keys = pc.gray(
        pc.bold('j') + '/' + pc.bold('k') + ': move | ' +
        pc.bold('SPACE') + ': toggle | ' +
        pc.bold('a') + ': all | ' +
        pc.bold('ENTER') + ': confirm | ' +
        pc.bold('q') + ': quit'
      );
      this.out(pc.bgYellow(pc.black(sel)) + ' ' + keys + '\r\n');
    }
    this.out('\r\n');

    let selectableCount = 0;
    let drawnRows = 0;

    for (const flatItem of this.state.flatList) {
      if (flatItem.isGroupHeader) {
        if (selectableCount >= this.state.scroll && drawnRows < this.maxVisible) {
          const name = getProfileName(flatItem.group);
          const items = this.state.results.filter((r) => r.profileId.split(',')[0] === flatItem.group);
          const sub = formatSize(totalSize(items));
          const row = MARGINS.ROW_RESULTS_START + drawnRows;
          this.clearRow(row);
          this.outAt(pc.cyan(`=== ${name} (${items.length} items, ${sub}) ===`), MARGINS.FOLDER_COLUMN_START, row);
          drawnRows++;
        }
        continue;
      }

      selectableCount++;
      if (selectableCount <= this.state.scroll) continue;
      if (drawnRows >= this.maxVisible) break;

      const row = MARGINS.ROW_RESULTS_START + drawnRows;
      const item = flatItem.item;
      const idx = flatItem.globalIndex;
      const isCursor = selectableCount === this.state.cursorIndex;
      const isSel = this.state.selected.has(idx);
      const num = String(idx).padStart(2, ' ');
      const size = formatSize(item.size).padStart(6, ' ');
      const path = shortenText(
        item.path.startsWith(HOME) ? `~${item.path.slice(HOME.length)}` : item.path,
        pathWidth
      );

      this.clearRow(row);

      if (isCursor) {
        const bg = ' '.repeat(columns - 1);
        let content = `${num} ${size}  ${path}`;
        if (isSel) content = `${num} ${size} ${pc.green('✔ ')}${path}`;
        this.outAt(pc.bgBlue(bg), 0, row);
        this.outAt(pc.bgBlue(content), MARGINS.FOLDER_COLUMN_START, row);
      } else if (isSel) {
        this.outAt(`${num} ${size} ${pc.green('✔ ')}${pc.blue(path)}`, MARGINS.FOLDER_COLUMN_START, row);
      } else {
        this.outAt(`${num} ${size}  ${path}`, MARGINS.FOLDER_COLUMN_START, row);
      }

      drawnRows++;
    }

    for (let r = drawnRows; r < this.maxVisible; r++) {
      this.clearRow(MARGINS.ROW_RESULTS_START + r);
    }

    const totalRow = this.terminal.rows - 2;
    this.clearRow(totalRow);
    this.outAt(pc.bold(`Total: ${this.state.results.length} items, ${formatSize(totalSize(this.state.results))}`), 0, totalRow);

    this.renderScrollBar(scrollMax, total);
  }

  private renderScrollBar(scrollMax: number, total: number): void {
    if (total <= this.maxVisible) return;
    const { rows, columns } = this.terminal;
    const barBg = pc.gray('┊');
    const barActive = pc.gray('█');
    const start = MARGINS.ROW_RESULTS_START;
    const end = rows - 3;
    const pct = scrollMax > 0 ? this.state.scroll / scrollMax : 0;
    const pos = Math.round(pct * (end - start) + start);

    for (let i = start; i <= end; i++) {
      this.outAt(barBg, columns - 1, i);
    }
    this.outAt(barActive, columns - 1, pos);
  }

  moveCursor(delta: number): void {
    const total = totalSelectable(this.state.flatList);
    this.state.cursorIndex = Math.max(1, Math.min(total, this.state.cursorIndex + delta));
    this.fitScroll();
  }

  moveCursorPage(delta: number): void {
    this.moveCursor(delta * this.maxVisible);
  }

  moveCursorFirst(): void {
    this.state.cursorIndex = 1;
    this.state.scroll = 0;
  }

  moveCursorLast(): void {
    this.state.cursorIndex = totalSelectable(this.state.flatList);
    this.fitScroll();
  }

  private fitScroll(): void {
    const total = totalSelectable(this.state.flatList);
    const scrollMax = Math.max(0, total - this.maxVisible);

    if (this.state.cursorIndex <= this.state.scroll) {
      this.state.scroll = this.state.cursorIndex - 1;
    } else if (this.state.cursorIndex > this.state.scroll + this.maxVisible) {
      this.state.scroll = this.state.cursorIndex - this.maxVisible;
    }

    this.state.scroll = Math.max(0, Math.min(this.state.scroll, scrollMax));
  }

  toggleSelect(): void {
    const item = selectableAtIndex(this.state.flatList, this.state.cursorIndex);
    if (!item) return;
    const idx = item.globalIndex;
    if (this.state.selected.has(idx)) this.state.selected.delete(idx);
    else this.state.selected.add(idx);
  }

  toggleSelectAll(): void {
    if (this.state.selected.size === this.state.results.length) {
      this.state.selected.clear();
    } else {
      for (let i = 1; i <= this.state.results.length; i++) this.state.selected.add(i);
    }
  }

  setMode(mode: TuiState['mode']): void {
    this.state.mode = mode;
  }

  getSelectedResults(): ScanResult[] {
    return [...this.state.selected]
      .filter((i) => i >= 1 && i <= this.state.results.length)
      .map((i) => this.state.results[i - 1]);
  }

  exit(): void {
    this.stopListening();
    this.out(ansiEscapes.cursorShow);
    this.out('\r\n');
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
      items: items.map((r) => ({ path: r.path, sizeBytes: r.size, profileId: r.profileId })),
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
