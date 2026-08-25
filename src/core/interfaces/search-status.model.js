export class ScanStatus {
  constructor() {
    this.pendingSearchTasks = 0;
    this.completedSearchTasks = 0;
    this.pendingStatsCalculation = 0;
    this.completedStatsCalculation = 0;
    this.resultsFound = 0;
    this.pendingDeletions = 0;
  }

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