import { Context } from "hono";
import { CloudflareBindings } from "../types";
import { sendToWebhook } from "../utils/webhook";
import {
  SlackMessageService,
  SlackMessage,
} from "../services/slackMessageService";
import { callClaudeApi } from "../utils/claudeApi";

export async function slackEventsHandler(
  c: Context<{ Bindings: CloudflareBindings }>
) {
  try {
    console.log("Starting to process incoming request");
    const payload = await c.req.json();
    console.log(
      "Received Slack webhook payload:",
      JSON.stringify(payload, null, 2)
    );

    // URL Verification
    if (payload.type === "url_verification") {
      console.log("Processing URL verification challenge");
      return c.json({ challenge: payload.challenge }, 200);
    }

    // 即座に200 OKレスポンスを返す
    c.executionCtx.waitUntil(
      (async () => {
        try {
          console.log("Initializing SlackMessageService");
          const messageService = new SlackMessageService(c.env.DB);

          // イベントがアプリメンションの場合のみ処理
          if (payload.event && payload.event.type === "app_mention") {
            const event = payload.event;
            console.log("Processing app_mention event:", {
              channel: event.channel,
              timestamp: event.ts,
              threadTs: event.thread_ts,
              hasText: !!event.text,
              messageType: event.subtype || "app_mention",
              user: event.user,
              eventId: event.event_id,
            });

            try {
              // メッセージをD1に保存
              const messageData: SlackMessage = {
                channelTimestamp: `${event.channel}-${event.ts}`,
                timestamp: event.ts,
                threadTimestamp: event.thread_ts,
                channelId: event.channel,
                text: event.text,
                role: "user",
              };

              console.log("Attempting to save user message to database:", {
                channelTimestamp: messageData.channelTimestamp,
                timestamp: messageData.timestamp,
                threadTimestamp: messageData.threadTimestamp,
                channelId: messageData.channelId,
                textLength: messageData.text.length,
                role: messageData.role,
              });

              await messageService.saveMessage(messageData);
              console.log("Successfully saved user message to database");

              // スレッドメッセージの場合、関連メッセージを取得
              let threadMessages: SlackMessage[] = [];
              if (event.thread_ts) {
                console.log(
                  "Attempting to fetch thread messages for thread_ts:",
                  event.thread_ts
                );
                try {
                  threadMessages = await messageService.findThreadMessages(
                    event.thread_ts
                  );
                  console.log("Successfully retrieved thread messages:", {
                    threadTs: event.thread_ts,
                    messageCount: threadMessages.length,
                    messages: threadMessages.map((msg) => ({
                      timestamp: msg.timestamp,
                      channelId: msg.channelId,
                      textLength: msg.text.length,
                      role: msg.role,
                    })),
                  });
                } catch (error) {
                  console.error("Error fetching thread messages:", {
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                    threadTs: event.thread_ts,
                  });
                  // スレッドメッセージの取得に失敗しても処理は続行
                }
              }

              // Claude APIを呼び出し
              console.log("Calling Claude API");
              const claudeResponse = await callClaudeApi(
                event.text,
                threadMessages,
                c.env.CLAUDE_API_KEY
              );

              // Claude APIの応答を保存
              const assistantMessageData: SlackMessage = {
                channelTimestamp: `${event.channel}-${Date.now()}`,
                timestamp: String(Date.now() / 1000),
                threadTimestamp: event.thread_ts || event.ts,
                channelId: event.channel,
                text: claudeResponse,
                role: "assistant",
              };

              console.log(
                "Attempting to save assistant response to database:",
                {
                  channelTimestamp: assistantMessageData.channelTimestamp,
                  timestamp: assistantMessageData.timestamp,
                  threadTimestamp: assistantMessageData.threadTimestamp,
                  channelId: assistantMessageData.channelId,
                  textLength: assistantMessageData.text.length,
                  role: assistantMessageData.role,
                }
              );

              await messageService.saveMessage(assistantMessageData);
              console.log("Successfully saved assistant response to database");

              // Slackにメッセージを送信
              try {
                await sendToWebhook(
                  {
                    ...payload,
                    message: claudeResponse,
                    thread_ts: event.thread_ts || event.ts,
                  },
                  threadMessages,
                  c.env
                );
                console.log("Successfully sent response to Slack");
              } catch (error) {
                console.error("Error sending response to Slack:", {
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                  stack: error instanceof Error ? error.stack : undefined,
                });
              }
            } catch (error) {
              console.error("Error processing app_mention event:", {
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined,
                event: {
                  channel: event.channel,
                  ts: event.ts,
                  thread_ts: event.thread_ts,
                  user: event.user,
                  event_id: event.event_id,
                },
              });
            }
          } else {
            console.log("Skipping non-app_mention event:", {
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
