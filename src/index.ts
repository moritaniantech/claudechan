import { Hono } from "hono";
import { CloudflareBindings } from "./types";
import { triggerMakeScenario } from "./utils/makeApi";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/slack/events", async (c) => {
  const payload = await c.req.json();

  // URL Verification
  if (payload.type === "url_verification") {
    return c.json({ challenge: payload.challenge });
  }

  // makeのシナリオを実行
  const makeResponse = await triggerMakeScenario(payload, c.env);

  if (!makeResponse.ok) {
    console.error("Failed to trigger Make scenario:", makeResponse.error);
    return c.json({ ok: false, error: makeResponse.error }, 500);
  }

  return c.json({ ok: true });
});

export default app;
