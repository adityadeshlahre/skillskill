import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { deleteDir, isProtected } from '../src/core/delete.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillskill-delete-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('isProtected', () => {
  it('protects $HOME itself', () => {
    expect(isProtected(os.homedir())).toBe(true);
  });

  it('protects shell config files', () => {
    expect(isProtected(path.join(os.homedir(), '.zshrc'))).toBe(true);
    expect(isProtected(path.join(os.homedir(), '.bashrc'))).toBe(true);
  });

  it('does not protect random paths', () => {
    expect(isProtected(tmpDir)).toBe(false);
  });
});

describe('deleteDir', () => {
  it('deletes a directory', () => {
    const dir = path.join(tmpDir, 'to-delete');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'file.txt'), 'data');

    const result = deleteDir(dir);
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBeUndefined();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('handles nonexistent path gracefully (force: true)', () => {
    const result = deleteDir('/nonexistent/path');
    expect(result.ok).toBe(true);
  });

  it('dry-run does not delete', () => {
    const dir = path.join(tmpDir, 'to-keep');
    fs.mkdirSync(dir);

    const result = deleteDir(dir, true);
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('refuses to delete protected paths', () => {
    const result = deleteDir(os.homedir());
    expect(result.ok).toBe(false);
    expect(result.error).toBe('protected path');
  });
});
