export class Logger {
  private requestId: string;

  constructor() {
    this.requestId = crypto.randomUUID();
  }

  info(message: string, data?: any) {
    console.log(
      `[INFO][${this.requestId}] ${message}`,
      data ? JSON.stringify(data) : ""
    );
  }

  error(message: string, error?: any) {
    console.error(`[ERROR][${this.requestId}] ${message}`, error);
  }

  debug(message: string, data?: any) {
    console.debug(
      `[DEBUG][${this.requestId}] ${message}`,
      data ? JSON.stringify(data) : ""
    );
  }
}

export const logger = new Logger();
