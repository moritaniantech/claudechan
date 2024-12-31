import { Context } from "hono";
import { Env } from "../types";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function setRequestContext(c: Context<{ Bindings: Env }>) {
  c.set("requestId", generateRequestId());
}

export function getRequestId(c: Context<{ Bindings: Env }>): string {
  return c.get("requestId");
}
