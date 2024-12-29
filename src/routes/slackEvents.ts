import { Context } from "hono";
import { CloudflareBindings } from "../types";
import { triggerMakeScenario } from "../utils/makeApi";
import {
  SlackMessageService,
  SlackMessage,
} from "../services/slackMessageService";

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
            console.log("Processing message event:", {
              channel: event.channel,
              timestamp: event.ts,
              threadTs: event.thread_ts,
              hasText: !!event.text,
              messageType: event.subtype || "message",
            });

            // メッセージをD1に保存
            const messageData: SlackMessage = {
              channelTimestamp: `${event.channel}-${event.ts}`,
              timestamp: event.ts,
              threadTimestamp: event.thread_ts,
              channelId: event.channel,
              text: event.text,
            };

            console.log("Saving message to D1:", {
              channelTimestamp: messageData.channelTimestamp,
              timestamp: messageData.timestamp,
              threadTimestamp: messageData.threadTimestamp,
              channelId: messageData.channelId,
              textLength: messageData.text.length,
            });

            await messageService.saveMessage(messageData);
            console.log("Successfully saved message to D1");

            // スレッドメッセージの場合、関連メッセージを取得
            let threadMessages: SlackMessage[] = [];
            if (event.thread_ts) {
              console.log(
                "Fetching thread messages for thread_ts:",
                event.thread_ts
              );
              threadMessages = await messageService.findThreadMessages(
                event.thread_ts
              );
              console.log("Retrieved thread messages:", {
                threadTs: event.thread_ts,
                messageCount: threadMessages.length,
                messages: threadMessages.map((msg) => ({
                  timestamp: msg.timestamp,
                  channelId: msg.channelId,
                  textLength: msg.text.length,
                })),
              });
            }

            // Make scenarioにデータを送信
            const makePayload = {
              ...payload,
              threadMessages: threadMessages,
            };

            console.log("Preparing Make scenario payload:", {
              type: payload.type,
              team_id: payload.team_id,
              api_app_id: payload.api_app_id,
              timestamp: new Date().toISOString(),
              threadMessagesCount: threadMessages.length,
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
          } else {
            console.log("Skipping non-message event:", {
              type: payload.type,
              eventType: payload.event?.type,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("Error in background processing:", {
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
            payload: JSON.stringify(payload),
          });
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
