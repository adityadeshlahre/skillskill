import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UserConfig, SkillProfile, CLIArgs, ResolvedConfig } from './interfaces/config.interface.js';
import { DEFAULT_PROFILES } from './constants.js';

export function expandHome(p: string): string {
  return p.replace(/^~/, os.homedir());
}

function readJson(filePath: string): UserConfig | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as UserConfig;
  } catch {
    return null;
  }
}

export function loadConfig(): UserConfig {
  const globalConfig = readJson(path.join(os.homedir(), '.skillskillrc'));
  const localConfig = readJson(path.join(process.cwd(), '.skillskillrc'));

  if (!globalConfig && !localConfig) return {};
  if (!globalConfig) return localConfig!;
  if (!localConfig) return globalConfig;

  return {
    rootDir: localConfig.rootDir ?? globalConfig.rootDir,
    exclude: [...(globalConfig.exclude ?? []), ...(localConfig.exclude ?? [])],
    dryRun: localConfig.dryRun ?? globalConfig.dryRun,
    disableProfiles: [
      ...(globalConfig.disableProfiles ?? []),
      ...(localConfig.disableProfiles ?? []),
    ],
    profiles: localConfig.profiles ?? globalConfig.profiles,
    addProfiles: [
      ...(globalConfig.addProfiles ?? []),
      ...(localConfig.addProfiles ?? []),
    ],
  };
}

export function resolveProfiles(fileConfig: UserConfig, cli: CLIArgs): SkillProfile[] {
  let profiles = DEFAULT_PROFILES.map((p) => ({ ...p, paths: [...p.paths] }));

  if (fileConfig.profiles) {
    for (const override of fileConfig.profiles) {
      const existing = profiles.find((p) => p.id === override.id);
      if (existing) {
        if (override.paths) existing.paths = override.paths;
        if (override.exclude) existing.exclude = override.exclude;
      }
    }
  }

  if (fileConfig.addProfiles) {
    profiles.push(...fileConfig.addProfiles);
  }

  if (fileConfig.disableProfiles) {
    profiles = profiles.filter((p) => !fileConfig.disableProfiles!.includes(p.id));
  }

  if (cli.profile) {
    profiles = profiles.filter((p) => p.id === cli.profile);
  }

  if (cli.disable) {
    profiles = profiles.filter((p) => !cli.disable!.includes(p.id));
  }

  return profiles;
}

export function resolveConfig(cli: CLIArgs, fileConfig: UserConfig): ResolvedConfig {
  return {
    rootDir: cli.root ?? fileConfig.rootDir ?? os.homedir(),
    explicitRoot: cli.root !== undefined || fileConfig.rootDir !== undefined,
    dryRun: cli.json ? true : (cli.dryRun ?? fileConfig.dryRun ?? true),
    deleteAll: cli.deleteAll ?? false,
    exclude: [...(fileConfig.exclude ?? []), ...(cli.exclude ?? [])],
    profiles: resolveProfiles(fileConfig, cli),
  };
}
