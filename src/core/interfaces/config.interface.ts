import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SkillProfile {
  id: string;
  name: string;
  paths: string[];
  exclude?: string[];
}

export interface UserConfig {
  rootDir?: string;
  exclude?: string[];
  dryRun?: boolean;
  disableProfiles?: string[];
  profiles?: Array<{
    id: string;
    paths?: string[];
    exclude?: string[];
  }>;
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
  modificationTime: number;
}

export interface DeleteResult {
  ok: boolean;
  path: string;
  error?: string;
  dryRun?: boolean;
}

export interface JSONOutput {
  root: string;
  scanDate: string;
  profiles: Record<
    string,
    {
      name: string;
      items: Array<{
        path: string;
        sizeBytes: number;
        profileId: string;
        modificationTime: string;
      }>;
      totalSizeBytes: number;
      count: number;
    }
  >;
  totalItems: number;
  totalSizeBytes: number;
}
