import * as os from 'os';
import * as readline from 'readline';
import ansiEscapes from 'ansi-escapes';
import pc from 'picocolors';
import { ScanResult, SkillProfile } from './interfaces/config.interface.js';
import { totalSize } from './scan.js';
import { DEFAULT_PROFILES } from './constants.js';

const HOME = os.homedir();
const MARGINS = { ROW_RESULTS_START: 6, FOLDER_COLUMN_START: 1 };
const CURSOR_COLOR = 'bgBlue';

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
  for (const group of groups.values()) {
    group.sort((a, b) => b.size - a.size);
  }
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
  let globalIdx = 0;

  for (const [groupId, items] of groups) {
    flat.push({
      globalIndex: -1,
      item: items[0],
      group: groupId,
      isGroupHeader: true,
    });
    for (const item of items) {
      globalIdx++;
      flat.push({ globalIndex: globalIdx, item, group: groupId, isGroupHeader: false });
    }
  }
  return flat;
}

function shortenText(text: string, width: number): string {
  if (text.length <= width) return text;
  return text.substring(0, width - 3) + '...';
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
  private buffer = '';
  private previousBuffer = '';
  private state: TuiState;
  private onKeyCallback: ((key: string, ctrl: boolean) => void) | null = null;
  private stdinRestore: (() => void) | null = null;

  constructor(results: ScanResult[], dryRun: boolean) {
    const flatList = buildFlatList(results);
    this.state = {
      results,
      flatList,
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
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const handler = (_: unknown, key: { name: string; sequence: string; ctrl: boolean }) => {
      if (key.name !== '') {
        this.onKeyCallback?.(key.name, key.ctrl);
      }
    };
    process.stdin.on('keypress', handler);

    this.stdinRestore = () => {
      process.stdin.removeListener('keypress', handler);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    };
  }

  stopListening(): void {
    this.stdinRestore?.();
    this.stdinRestore = null;
  }

  private print(text: string): void {
    this.buffer += text;
  }

  private printAt(text: string, x: number, y: number): void {
    this.print(ansiEscapes.cursorTo(x, y));
    this.print(text);
  }

  private clearLine(row: number): void {
    this.printAt(ansiEscapes.eraseLine, 0, row);
  }

  private flush(): void {
    if (this.buffer === this.previousBuffer) {
      this.buffer = '';
      return;
    }
    process.stdout.write(this.buffer);
    this.previousBuffer = this.buffer;
    this.buffer = '';
  }

  private get terminal(): { columns: number; rows: number } {
    return {
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
    };
  }

  private getVisibleItems(): FlatItem[] {
    const { rows } = this.terminal;
    const maxVisible = rows - MARGINS.ROW_RESULTS_START - 2;
    const visible: FlatItem[] = [];

    let count = 0;
    for (let i = 0; i < this.state.flatList.length; i++) {
      if (count >= maxVisible) break;
      visible.push(this.state.flatList[i]);
      if (!this.state.flatList[i].isGroupHeader) count++;
    }
    return visible;
  }

  private getSelectableItemAtCursor(): FlatItem | null {
    const visible = this.getVisibleItems();
    let selectableCount = 0;
    for (const item of visible) {
      if (item.isGroupHeader) continue;
      selectableCount++;
      if (selectableCount === this.state.cursorIndex) return item;
    }
    return null;
  }

  render(): void {
    const { columns, rows } = this.terminal;
    const pathWidth = columns - 16;

    this.buffer = '';
    this.print(ansiEscapes.clearTerminal);

    const title = this.state.dryRun
      ? pc.bold('SkillSkill — DRY RUN')
      : pc.bold('SkillSkill');
    this.print(title + '\r\n');

    if (this.state.selectMode) {
      const selectedMsg = `${this.state.selected.size} selected `;
      const instruction = pc.gray(
        pc.bold('j') + '/' + pc.bold('k') + ': move | ' +
        pc.bold('SPACE') + ': toggle | ' +
        pc.bold('a') + ': all | ' +
        pc.bold('ENTER') + ': confirm | ' +
        pc.bold('q') + ': quit'
      );
      const line = pc.bgYellow(pc.black(selectedMsg)) + ' ' + instruction;
      this.print(line + '\r\n');
    }

    this.print('\r\n');

    const visible = this.getVisibleItems();
    let selectableRow = 0;

    for (const flatItem of visible) {
      const row = MARGINS.ROW_RESULTS_START + selectableRow;
      this.clearLine(row);

      if (flatItem.isGroupHeader) {
        const name = getProfileName(flatItem.group);
        const items = this.state.results.filter(
          (r) => r.profileId.split(',')[0] === flatItem.group
        );
        const subtotal = formatSize(totalSize(items));
        const header = pc.cyan(`=== ${name} (${items.length} items, ${subtotal}) ===`);
        this.printAt(header, MARGINS.FOLDER_COLUMN_START, row);
        selectableRow++;
        continue;
      }

      const item = flatItem.item;
      const globalIdx = flatItem.globalIndex;
      const isCursor = this.state.cursorIndex === (selectableRow + 1) && this.state.mode === 'select';
      const isSelected = this.state.selected.has(globalIdx);
      const num = String(globalIdx).padStart(2, ' ');
      const size = formatSize(item.size).padStart(6, ' ');
      const displayPath = shortenText(
        item.path.startsWith(HOME) ? `~${item.path.slice(HOME.length)}` : item.path,
        pathWidth
      );

      let indicator = '  ';
      if (isSelected) indicator = pc.green('✔ ');

      let line: string;
      if (isCursor) {
        const content = `${num} ${size} ${indicator}${displayPath}`;
        line = pc[CURSOR_COLOR](content);
        this.printAt(pc[CURSOR_COLOR](' '.repeat(columns - 1)), 0, row);
      } else if (isSelected) {
        line = `${num} ${size} ${pc.green('✔ ')}${pc.blue(displayPath)}`;
      } else {
        line = `${num} ${size}  ${displayPath}`;
      }

      this.printAt(line, MARGINS.FOLDER_COLUMN_START, row);
      selectableRow++;
    }

    const totalRow = rows - 2;
    this.clearLine(totalRow);
    const total = formatSize(totalSize(this.state.results));
    this.printAt(pc.bold(`Total: ${this.state.results.length} items, ${total}`), 0, totalRow);

    this.printScrollBar();
    this.flush();
  }

  private printScrollBar(): void {
    const { rows } = this.terminal;
    const totalResults = this.state.results.length;
    const maxVisible = rows - MARGINS.ROW_RESULTS_START - 2;

    if (totalResults <= maxVisible) return;

    const scrollBarBg = pc.gray('┊');
    const scrollBarActive = pc.gray('█');
    const start = MARGINS.ROW_RESULTS_START;
    const end = rows - 3;
    const scrollPercentage = this.state.scroll / (totalResults - maxVisible);
    const scrollBarPosition = Math.round(scrollPercentage * (end - start) + start);

    for (let i = start; i <= end; i++) {
      this.printAt(scrollBarBg, this.terminal.columns - 1, i);
    }
    this.printAt(scrollBarActive, this.terminal.columns - 1, scrollBarPosition);
  }

  moveCursor(delta: number): void {
    const maxSelectable = this.state.results.length;
    const oldIndex = this.state.cursorIndex;
    this.state.cursorIndex = Math.max(1, Math.min(maxSelectable, this.state.cursorIndex + delta));
    if (oldIndex !== this.state.cursorIndex) this.fitScroll();
  }

  moveCursorPage(delta: number): void {
    const { rows } = this.terminal;
    const pageSize = rows - MARGINS.ROW_RESULTS_START - 2;
    this.moveCursor(delta * pageSize);
  }

  moveCursorFirst(): void {
    this.state.cursorIndex = 1;
    this.state.scroll = 0;
  }

  moveCursorLast(): void {
    this.state.cursorIndex = this.state.results.length;
    this.fitScroll();
  }

  private fitScroll(): void {
    const { rows } = this.terminal;
    const maxVisible = rows - MARGINS.ROW_RESULTS_START - 2;
    const cursorRow = this.state.cursorIndex + this.state.scroll;

    if (cursorRow < this.state.scroll + 1) {
      this.state.scroll = cursorRow - 1;
    } else if (cursorRow > this.state.scroll + maxVisible) {
      this.state.scroll = cursorRow - maxVisible;
    }
    this.state.scroll = Math.max(0, Math.min(this.state.scroll, this.state.results.length - maxVisible));
  }

  toggleSelect(): void {
    const item = this.getSelectableItemAtCursor();
    if (!item) return;
    const idx = item.globalIndex;
    if (this.state.selected.has(idx)) {
      this.state.selected.delete(idx);
    } else {
      this.state.selected.add(idx);
    }
  }

  toggleSelectAll(): void {
    if (this.state.selected.size === this.state.results.length) {
      this.state.selected.clear();
    } else {
      for (let i = 1; i <= this.state.results.length; i++) {
        this.state.selected.add(i);
      }
    }
  }

  setMode(mode: TuiState['mode']): void {
    this.state.mode = mode;
  }

  updateDeletionResult(ok: boolean, path: string, size: number): void {
    if (ok) {
      this.state.deleted++;
      this.state.freedBytes += size;
    } else {
      this.state.failed++;
    }
  }

  getSelectedResults(): ScanResult[] {
    return [...this.state.selected]
      .filter((i) => i >= 1 && i <= this.state.results.length)
      .map((i) => this.state.results[i - 1]);
  }

  exit(): void {
    this.stopListening();
    this.print(ansiEscapes.cursorShow);
    this.print('\r\n');
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
