import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  SlackEvent,
  SlackChallengeRequest,
  SlackChallengeResponse,
  Env,
} from "../types";
import { SlackEventService } from "../services/slackEventService";

const slack = new Hono<{ Bindings: Env }>();

// CORSミドルウェアを追加
slack.use(
  "/webhook",
  cors({
    origin: "*",
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

// Slackイベントを処理するルート
slack.post("/webhook", async (c) => {
  try {
    // Content-Typeの検証
    const contentType = c.req.header("Content-Type");
    if (!contentType?.includes("application/json")) {
      return c.json(
        { ok: false, error: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    const payload = (await c.req.json()) as SlackEvent;
    console.log("Received Slack webhook:", {
      type: payload.type,
      event_id: payload.event_id,
    });

    // URL検証チャレンジの処理
    if (payload.type === "url_verification") {
      const challenge = (payload as SlackChallengeRequest).challenge;
      const response: SlackChallengeResponse = { challenge };
      return new Response(JSON.stringify(response), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

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
