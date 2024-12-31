import { Context } from "hono";
import { Env, RequestContext } from "../types";

declare module "hono" {
  interface ContextVariableMap {
    requestContext: RequestContext;
  }
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function initializeRequestContext(c: Context<{ Bindings: Env }>) {
  if (!c.get("requestContext")) {
    c.set("requestContext", {
      requestId: generateRequestId(),
    });
  }
}

export function getRequestContext(
  c: Context<{ Bindings: Env }>
): RequestContext {
  return c.get("requestContext");
}

export function getRequestId(c: Context<{ Bindings: Env }>): string {
  return getRequestContext(c).requestId;
}
