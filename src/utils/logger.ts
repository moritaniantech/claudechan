export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : "");
  },

  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  },

  debug: (message: string, data?: any) => {
    console.debug(`[DEBUG] ${message}`, data ? JSON.stringify(data) : "");
  },
};
