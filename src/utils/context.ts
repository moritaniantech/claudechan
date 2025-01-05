import { Context } from "hono";
import { RequestIdVariables } from "hono/request-id";
import { Env } from "../types";

declare module "hono" {
  interface ContextVariableMap extends RequestIdVariables {}
}

export function getRequestId(c: Context<{ Bindings: Env }>): string {
  return c.var.requestId;
}
