import { Context } from "hono";
import { CloudflareBindings } from "../types";
import { triggerMakeScenario } from "../utils/makeApi";
import { SlackMessageService } from "../services/slackMessageService";

export async function slackEventsHandler(
  c: Context<{ Bindings: CloudflareBindings }>
) {
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
          const messageService = new SlackMessageService(c.env.DB);

          // イベントがメッセージの場合のみ処理
          if (payload.event && payload.event.type === "message") {
            const event = payload.event;

            // メッセージをD1に保存
            await messageService.saveMessage({
              channelTimestamp: `${event.channel}-${event.ts}`,
              timestamp: event.ts,
              threadTimestamp: event.thread_ts,
              channelId: event.channel,
              text: event.text,
            });

            // スレッドメッセージの場合、関連メッセージを取得
            let threadMessages = [];
            if (event.thread_ts) {
              threadMessages = await messageService.findThreadMessages(
                event.thread_ts
              );
            }

            // Make scenarioにデータを送信
            const makePayload = {
              ...payload,
              threadMessages: threadMessages,
            };

            console.log("Triggering Make scenario with event type:", {
              type: payload.type,
              team_id: payload.team_id,
              api_app_id: payload.api_app_id,
              timestamp: new Date().toISOString(),
            });

            const makeResponse = await triggerMakeScenario(makePayload, c.env);

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
          }
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
}
