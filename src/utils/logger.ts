// ランダムなprocessIdを生成（サーバー起動時に一度だけ生成）
const processId = crypto.randomUUID();

export const logger = {
  info: (message: string, data?: any) => {
    console.log(
      `[INFO][${processId}] ${message}`,
      data ? JSON.stringify(data) : ""
    );
  },

  error: (message: string, error?: any) => {
    console.error(`[ERROR][${processId}] ${message}`, error);
  },

  debug: (message: string, data?: any) => {
    console.debug(
      `[DEBUG][${processId}] ${message}`,
      data ? JSON.stringify(data) : ""
    );
  },
};
