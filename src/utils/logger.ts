import { Context } from "hono";
import { Env } from "../types";
import { getRequestId } from "./context";

export class Logger {
  private requestId: string;

  constructor(c: Context<{ Bindings: Env }>) {
    this.requestId = getRequestId(c);
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

export function createLogger(c: Context<{ Bindings: Env }>) {
  return new Logger(c);
}
