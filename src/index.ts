import { Hono } from "hono";
import { CloudflareBindings } from "./types";
import { triggerMakeScenario } from "./utils/makeApi";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/slack/events", async (c) => {
  try {
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

    // 即座に200 OKレスポンスを返す
    c.executionCtx.waitUntil(
      (async () => {
        try {
          console.log("Triggering Make scenario with event type:", {
            type: payload.type,
            team_id: payload.team_id,
            api_app_id: payload.api_app_id,
            timestamp: new Date().toISOString(),
          });

          const makeResponse = await triggerMakeScenario(payload, c.env);

          if (!makeResponse.ok) {
            console.error("Failed to trigger Make scenario:", {
              error: makeResponse.error,
              eventType: payload.type,
              team_id: payload.team_id,
              timestamp: new Date().toISOString(),
            });
            return;
          }

          console.log("Successfully triggered Make scenario:", {
            eventType: payload.type,
            team_id: payload.team_id,
            timestamp: new Date().toISOString(),
            response: makeResponse.data,
          });
        } catch (error) {
          console.error("Error in background processing:", error);
        }
      })()
    );

    return c.json({ ok: true });
  } catch (error) {
    console.error("Error processing Slack event:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

export default app;
