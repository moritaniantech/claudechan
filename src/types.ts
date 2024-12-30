import { D1Database } from "@cloudflare/workers-types";

export interface CloudflareBindings {
  MAKE_WEBHOOK_URL: string;
  DB: D1Database;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  CLAUDE_API_KEY: string;
}
