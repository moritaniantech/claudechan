export const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(
      JSON.stringify({
        timestamp,
        level: "INFO",
        message,
        data: data || null,
      })
    );
  },

  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(
      JSON.stringify({
        timestamp,
        level: "ERROR",
        message,
        error: error ? (error instanceof Error ? error.stack : error) : null,
      })
    );
  },

  debug: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.debug(
      JSON.stringify({
        timestamp,
        level: "DEBUG",
        message,
        data: data || null,
      })
    );
  },

  trace: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(
      JSON.stringify({
        timestamp,
        level: "TRACE",
        message,
        data: data || null,
      })
    );
  },
};
