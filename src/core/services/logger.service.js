export class LoggerService {
  constructor() {
    this.logs = [];
  }

  info(message) {
    console.log(`[INFO] ${message}`);
  }

  error(message) {
    console.error(`[ERROR] ${message}`);
  }

  getLog$() {
    return new Observable((observer) => {
      observer.next(this.logs.join('\n') || 'No logs');
      observer.complete();
    });
  }

  setLogs(logs) {
    this.logs = logs;
  }
}