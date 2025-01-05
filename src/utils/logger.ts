import { Context } from "hono";
import { Env } from "../types";
import { getRequestId } from "./context";

class Logger {
  private requestId: string = "default";

  updateContext(c: Context<{ Bindings: Env }>) {
    this.requestId = getRequestId(c);
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${level}][${this.requestId}][${timestamp}] ${message}`;
    return data ? `${baseMessage} ${JSON.stringify(data)}` : baseMessage;
  }

  info(message: string, data?: any) {
    console.log(this.formatMessage("INFO", message, data));
  }

  error(message: string, error?: any) {
    console.error(this.formatMessage("ERROR", message, error));
  }

  debug(message: string, data?: any) {
    console.debug(this.formatMessage("DEBUG", message, data));
  }

  warn(message: string, data?: any) {
    console.warn(this.formatMessage("WARN", message, data));
  }
}

export const logger = new Logger();

export function updateLoggerContext(c: Context<{ Bindings: Env }>) {
  logger.updateContext(c);
}
