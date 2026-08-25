export const NpkillInterface = {
  startScan$: function (rootPath, options) {},
  getSize$: function (path) {},
  delete$: function (path, options) {},
  getLogs$: function () {},
  stopScan: function () {},
  isValidRootFolder: function (path) { return { isValid: true }; },
  getVersion: function () {},
  logger: {},
};

export interface ScanOptions {
  targets: string[];
  exclude: string[];
  performRiskAnalysis?: boolean;
  sortBy?: string;
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
  dryRun?: boolean;
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