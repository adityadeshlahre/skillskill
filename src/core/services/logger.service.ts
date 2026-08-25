export class LoggerService {
  logs: string[] = [];

  info(message: string) {
    console.log(`[INFO] ${message}`);
  }

  error(message: string) {
    console.error(`[ERROR] ${message}`);
  }

  getLogs(): string {
    return this.logs.join('\n') || 'No logs';
  }

  setLogs(logs: string[]) {
    this.logs = logs;
  }
}
