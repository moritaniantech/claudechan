import { Hono } from "hono";
import {
  SlackEvent,
  SlackChallengeRequest,
  SlackChallengeResponse,
  Env,
} from "../types";
import { SlackEventService } from "../services/slackEventService";

const slack = new Hono<{ Bindings: Env }>();

// Slackイベントを処理するルート
slack.post("/webhook", async (c) => {
  try {
    const payload = (await c.req.json()) as SlackEvent;

    // URL検証チャレンジの処理
    if (payload.type === "url_verification") {
      return new Response(
        JSON.stringify({
          challenge: (payload as SlackChallengeRequest).challenge,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Received Slack webhook:", {
      type: payload.type,
      event_id: payload.event_id,
    });

    // イベントコールバックの処理
    if (payload.type === "event_callback") {
      const slackEventService = new SlackEventService(c.env);
      const response = await slackEventService.handleEventCallback(payload);
      return c.json(response);
    }

    // その他のイベントタイプの処理
    console.warn("Unhandled event type:", payload.type);
    return c.json({ ok: true, message: "Event received" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return c.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
});

export default slack;
