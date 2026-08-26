export interface SkillProfile {
  id: string;
  name: string;
  paths: string[];
  exclude?: string[];
}

export interface ProfileOverride {
  id: string;
  paths?: string[];
  exclude?: string[];
}

export interface UserConfig {
  rootDir?: string;
  exclude?: string[];
  dryRun?: boolean;
  disableProfiles?: string[];
  profiles?: ProfileOverride[];
  addProfiles?: SkillProfile[];
}

export interface CLIArgs {
  root?: string;
  dryRun?: boolean;
  delete?: boolean;
  deleteAll?: boolean;
  json?: boolean;
  exclude?: string[];
  profile?: string;
  disable?: string[];
}

export interface ResolvedConfig {
  rootDir: string;
  dryRun: boolean;
  deleteAll: boolean;
  exclude: string[];
  profiles: SkillProfile[];
}

export interface ScanResult {
  path: string;
  size: number;
  profileId: string;
}

export interface DeleteResult {
  ok: boolean;
  path: string;
  error?: string;
  dryRun?: boolean;
}
