export class Logger {
  private generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
  };

  info(message: string, data?: any) {
    console.log(
      `[INFO][${this.generateId()}] ${message}`,
      data ? JSON.stringify(data) : ""
    );
  }

  error(message: string, error?: any) {
    console.error(`[ERROR][${this.generateId()}] ${message}`, error);
  }

  debug(message: string, data?: any) {
    console.debug(
      `[DEBUG][${this.generateId()}] ${message}`,
      data ? JSON.stringify(data) : ""
    );
  }
}

export const logger = new Logger();
