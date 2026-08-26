import { describe, it, expect } from 'vitest';
import { resolveProfiles, resolveConfig, expandHome } from '../src/core/config.js';
import { UserConfig, CLIArgs } from '../src/core/interfaces/config.interface.js';

describe('expandHome', () => {
  it('replaces ~ with home directory', () => {
    const result = expandHome('~/test');
    expect(result).toBe(`${process.env.HOME}/test`);
  });

  it('leaves absolute paths unchanged', () => {
    const result = expandHome('/usr/local/test');
    expect(result).toBe('/usr/local/test');
  });
});

describe('resolveProfiles', () => {
  const emptyCli: CLIArgs = {};

  it('returns default profiles when no config', () => {
    const profiles = resolveProfiles({}, emptyCli);
    expect(profiles).toHaveLength(3);
    expect(profiles.map((p) => p.id)).toEqual(['opencode', 'claude', 'cursor']);
  });

  it('overrides profile paths by id', () => {
    const config: UserConfig = {
      profiles: [{ id: 'opencode', paths: ['/custom/path'] }],
    };
    const profiles = resolveProfiles(config, emptyCli);
    const opencode = profiles.find((p) => p.id === 'opencode');
    expect(opencode?.paths).toEqual(['/custom/path']);
  });

  it('adds custom profiles', () => {
    const config: UserConfig = {
      addProfiles: [{ id: 'custom', name: 'Custom', paths: ['/custom'] }],
    };
    const profiles = resolveProfiles(config, emptyCli);
    expect(profiles).toHaveLength(4);
    expect(profiles.find((p) => p.id === 'custom')).toBeDefined();
  });

  it('disables profiles by id', () => {
    const config: UserConfig = {
      disableProfiles: ['cursor'],
    };
    const profiles = resolveProfiles(config, emptyCli);
    expect(profiles).toHaveLength(2);
    expect(profiles.find((p) => p.id === 'cursor')).toBeUndefined();
  });

  it('filters by --profile flag', () => {
    const cli: CLIArgs = { profile: 'claude' };
    const profiles = resolveProfiles({}, cli);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('claude');
  });

  it('filters by --disable flag', () => {
    const cli: CLIArgs = { disable: ['opencode', 'cursor'] };
    const profiles = resolveProfiles({}, cli);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('claude');
  });
});

describe('resolveConfig', () => {
  it('defaults to homedir, dry-run, no deleteAll', () => {
    const config = resolveConfig({}, {});
    expect(config.rootDir).toBe(process.env.HOME);
    expect(config.dryRun).toBe(true);
    expect(config.deleteAll).toBe(false);
    expect(config.exclude).toEqual([]);
  });

  it('CLI --root overrides config', () => {
    const cli: CLIArgs = { root: '/custom' };
    const config = resolveConfig(cli, { rootDir: '/from-file' });
    expect(config.rootDir).toBe('/custom');
  });

  it('--json forces dry-run', () => {
    const cli: CLIArgs = { json: true, dryRun: false };
    const config = resolveConfig(cli, {});
    expect(config.dryRun).toBe(true);
  });

  it('merges exclude from config and CLI', () => {
    const cli: CLIArgs = { exclude: ['cli-pat'] };
    const fileConfig: UserConfig = { exclude: ['file-pat'] };
    const config = resolveConfig(cli, fileConfig);
    expect(config.exclude).toEqual(['file-pat', 'cli-pat']);
  });
});
