import { Hono } from "hono";
import { CloudflareBindings } from "./types";
import { triggerMakeScenario } from "./utils/makeApi";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/slack/events", async (c) => {
  const payload = await c.req.json();
  console.log(
    "Received Slack webhook payload:",
    JSON.stringify(payload, null, 2)
  );

  // URL Verification
  if (payload.type === "url_verification") {
    console.log("Processing URL verification challenge");
    return c.json({ challenge: payload.challenge });
  }

  console.log("Triggering Make scenario with event type:", payload.type);
  // makeのシナリオを実行
  const makeResponse = await triggerMakeScenario(payload, c.env);

  if (!makeResponse.ok) {
    console.error("Failed to trigger Make scenario:", {
      error: makeResponse.error,
      eventType: payload.type,
      timestamp: new Date().toISOString(),
    });
    return c.json({ ok: false, error: makeResponse.error }, 500);
  }

  console.log("Successfully triggered Make scenario:", {
    eventType: payload.type,
    timestamp: new Date().toISOString(),
  });
  return c.json({ ok: true });
});

export default app;
