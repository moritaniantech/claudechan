export interface CloudflareBindings {
  MAKE_API_TOKEN: string;
  MAKE_SCENARIO_ID: string;
  DB: D1Database;
}

import { D1Database } from "@cloudflare/workers-types";
