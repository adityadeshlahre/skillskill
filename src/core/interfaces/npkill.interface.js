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

export const ScanOptions = {
  targets: [],
  exclude: [],
  performRiskAnalysis: true,
  sortBy: 'size'
};

export const ScanFoundFolder = {
  path: '',
  size: 0,
  modificationTime: -1,
  riskAnalysis: { isSensitive: false },
  status: 'live'
};

export const RiskAnalysis = {
  isSensitive: false,
  reason: undefined
};

export const DeleteOptions = {
  dryRun: false
};

export const GetSizeResult = {
  size: 0,
  unit: 'bytes'
};

export const GetNewestFileResult = {
  timestamp: 0,
  name: '',
  path: ''
};