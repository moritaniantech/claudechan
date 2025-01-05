import { Context } from "hono";
import { Env, RequestContext } from "../types";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    requestContext: RequestContext;
  }
}

export function initializeRequestContext(c: Context<{ Bindings: Env }>) {
  if (!c.get("requestContext")) {
    c.set("requestContext", {
      requestId: c.var.requestId,
    });
  }
}

export function getRequestContext(
  c: Context<{ Bindings: Env }>
): RequestContext {
  return c.get("requestContext");
}

export function getRequestId(c: Context<{ Bindings: Env }>): string {
  return c.var.requestId;
}
