export class ScanStatus {
  pendingSearchTasks: number = 0;
  completedSearchTasks: number = 0;
  pendingStatsCalculation: number = 0;
  completedStatsCalculation: number = 0;
  resultsFound: number = 0;
  pendingDeletions: number = 0;

  constructor() {}

  reset() {
    this.pendingSearchTasks = 0;
    this.completedSearchTasks = 0;
    this.pendingStatsCalculation = 0;
    this.completedStatsCalculation = 0;
    this.resultsFound = 0;
    this.pendingDeletions = 0;
  }

  newResult() {
    this.resultsFound++;
    this.pendingStatsCalculation++;
  }

  completeStatCalculation() {
    this.pendingStatsCalculation--;
    this.completedStatsCalculation++;
  }
}
