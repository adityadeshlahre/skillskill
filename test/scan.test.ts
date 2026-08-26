import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scanWithProfiles, getFolderSize } from '../src/core/scan.js';
import { SkillProfile } from '../src/core/interfaces/config.interface.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillskill-test-'));
});

afterEach(() => {
  // Fix permissions before cleanup
  try {
    const nopermDir = path.join(tmpDir, 'noperm');
    if (fs.existsSync(nopermDir)) fs.chmodSync(nopermDir, 0o755);
  } catch {}
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getFolderSize', () => {
  it('returns 0 for empty directory', () => {
    expect(getFolderSize(tmpDir)).toBe(0);
  });

  it('calculates recursive size', () => {
    const subDir = path.join(tmpDir, 'sub');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'hello'); // 5 bytes
    fs.writeFileSync(path.join(subDir, 'b.txt'), 'world!'); // 6 bytes
    expect(getFolderSize(tmpDir)).toBe(11);
  });

  it('handles permission errors gracefully', () => {
    const noReadDir = path.join(tmpDir, 'noperm');
    fs.mkdirSync(noReadDir, { mode: 0o000 });
    // Should not throw
    const size = getFolderSize(tmpDir);
    expect(size).toBeGreaterThanOrEqual(0);
  });
});

describe('scanWithProfiles', () => {
  it('scans profile directories and returns results', () => {
    const skillDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'file.txt'), 'data');

    const profile: SkillProfile = {
      id: 'test',
      name: 'Test',
      paths: [skillDir],
    };

    const results = scanWithProfiles([profile]);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(skillDir);
    expect(results[0].profileId).toBe('test');
    expect(results[0].size).toBeGreaterThan(0);
  });

  it('handles nonexistent directories gracefully', () => {
    const profile: SkillProfile = {
      id: 'test',
      name: 'Test',
      paths: ['/nonexistent/path'],
    };

    const results = scanWithProfiles([profile]);
    expect(results).toHaveLength(0);
  });

  it('excludes paths matching exclude patterns', () => {
    const subDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(subDir);
    fs.mkdirSync(path.join(subDir, 'node_modules'));

    const profile: SkillProfile = {
      id: 'test',
      name: 'Test',
      paths: [tmpDir],
      exclude: ['node_modules'],
    };

    const results = scanWithProfiles([profile]);
    const hasNodeModules = results.some((r) => r.path.includes('node_modules'));
    expect(hasNodeModules).toBe(false);
  });

  it('applies global exclude', () => {
    const subDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(subDir);

    const profile: SkillProfile = {
      id: 'test',
      name: 'Test',
      paths: [tmpDir],
    };

    const results = scanWithProfiles([profile], ['skills']);
    expect(results).toHaveLength(0);
  });

  it('deduplicates by path', () => {
    const skillDir = path.join(tmpDir, 'shared');
    fs.mkdirSync(skillDir);

    const profiles: SkillProfile[] = [
      { id: 'a', name: 'A', paths: [skillDir] },
      { id: 'b', name: 'B', paths: [skillDir] },
    ];

    const results = scanWithProfiles(profiles);
    expect(results).toHaveLength(1);
    expect(results[0].profileId).toContain('a');
    expect(results[0].profileId).toContain('b');
  });
});
