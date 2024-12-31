const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
};

export class Logger {
  info(message: string, data?: any) {
    console.log(
      `[INFO][${generateId()}] ${message}`,
      data ? JSON.stringify(data) : ""
    );
  }

  error(message: string, error?: any) {
    console.error(`[ERROR][${generateId()}] ${message}`, error);
  }

  debug(message: string, data?: any) {
    console.debug(
      `[DEBUG][${generateId()}] ${message}`,
      data ? JSON.stringify(data) : ""
    );
  }
}

export const logger = new Logger();
