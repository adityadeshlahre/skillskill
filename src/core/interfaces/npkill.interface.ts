export interface NpkillInterface {
  startScan$: (rootPath: string, options: any) => any;
  getSize$: (path: string) => any;
  delete$: (path: string, options: { dryRun?: boolean }) => any;
  getLogs$(): any;
  stopScan(): any;
  isValidRootFolder(path: string): { isValid: boolean; invalidReason?: string };
  getVersion(): string;
  logger: any;
  createDefaultFileService(): any;
}

export interface ScanOptions {
  targets: string[];
  exclude: string[];
  performRiskAnalysis: boolean;
  sortBy: string;
}

export interface ScanFoundFolder {
  path: string;
  size: number;
  modificationTime: number;
  riskAnalysis: RiskAnalysis;
  status: string;
}

export interface RiskAnalysis {
  isSensitive: boolean;
  reason?: string;
}

export interface DeleteOptions {
  dryRun: boolean;
}

export interface GetSizeResult {
  size: number;
  unit: string;
}

export interface GetNewestFileResult {
  timestamp: number;
  name: string;
  path: string;
}
