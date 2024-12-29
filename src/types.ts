import { D1Database } from "@cloudflare/workers-types";

export interface CloudflareBindings {
  MAKE_WEBHOOK_URL: string;
  DB: D1Database;
}
