import { MessageService } from "../services/messageService";
import { DatabaseService } from "../services/databaseService";
import { AnthropicService } from "../services/anthropicService";
import { logger } from "../utils/logger";
import { createSlackClient } from "../utils/slackClient";
import { Env } from "../types";
import { Context } from "hono";

interface SlackEventBody {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    subtype?: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    [key: string]: any;
  };
  token?: string;
  team_id?: string;
  api_app_id?: string;
}

export const createSlackEventHandler = (env: Env) => {
  const db = new DatabaseService(env.DB);
  const anthropic = new AnthropicService(env.ANTHROPIC_API_KEY);
  const slackClient = createSlackClient(
    env.SLACK_BOT_TOKEN,
    env.SLACK_SIGNING_SECRET
  );
  const messageService = new MessageService(
    db,
    anthropic,
    env.BOT_USER_ID,
    slackClient
  );

  return async (c: Context) => {
    const requestId = crypto.randomUUID();
    try {
      logger.trace(`[${requestId}] Starting request processing`);

      // Verify Slack request signature
      const signature = c.req.header("x-slack-signature");
      const timestamp = c.req.header("x-slack-request-timestamp");
      const rawBody = await c.req.raw.clone().text();

      logger.debug(`[${requestId}] Request headers`, {
        signature: signature ? "present" : "missing",
        timestamp: timestamp || "missing",
      });

      if (!signature || !timestamp) {
        logger.error(`[${requestId}] Missing Slack signature or timestamp`);
        return c.text("Unauthorized", 401);
      }

      logger.trace(`[${requestId}] Verifying Slack signature`);
      if (!slackClient.verifySlackRequest(signature, timestamp, rawBody)) {
        logger.error(`[${requestId}] Invalid Slack signature`);
        return c.text("Unauthorized", 401);
      }

      const body = (await c.req.json()) as SlackEventBody;
      logger.info(`[${requestId}] Received Slack event`, {
        type: body.type,
        event: body.event?.type,
        team: body.team_id,
        api_app_id: body.api_app_id,
      });

      // Handle URL verification
      if (body.type === "url_verification" && body.challenge) {
        logger.info(`[${requestId}] Handling URL verification challenge`);
        return c.text(body.challenge, 200);
      }

      // 即座に200を返す
      logger.trace(`[${requestId}] Sending immediate 200 response`);
      c.header("X-Slack-No-Retry", "1");
      const response = c.text("OK", 200);

      // 非同期で後続の処理を実行
      if (body.type === "event_callback" && body.event) {
        const event = body.event;
        logger.info(`[${requestId}] Processing event`, {
          eventType: event.type,
          channel: event.channel,
          user: event.user,
          hasText: !!event.text,
          hasThread: !!event.thread_ts,
        });

        try {
          switch (event.type) {
            case "app_mention":
              logger.info(`[${requestId}] Handling app mention event`, {
                channel: event.channel,
                user: event.user,
                thread_ts: event.thread_ts,
                textLength: event.text?.length,
              });
              messageService.handleAppMention(event).catch((error) => {
                logger.error(
                  `[${requestId}] Error in app mention handler`,
                  error
                );
              });
              break;

            case "message":
              if (!event.subtype) {
                logger.info(`[${requestId}] Handling message event`, {
                  channel: event.channel,
                  user: event.user,
                  thread_ts: event.thread_ts,
                  textLength: event.text?.length,
                });
                messageService.handleMessage(event).catch((error) => {
                  logger.error(
                    `[${requestId}] Error in message handler`,
                    error
                  );
                });
              } else {
                logger.info(`[${requestId}] Ignoring message with subtype`, {
                  subtype: event.subtype,
                });
              }
              break;

            default:
              logger.info(`[${requestId}] Ignoring unhandled event type`, {
                type: event.type,
              });
          }
        } catch (error) {
          logger.error(`[${requestId}] Error processing event`, {
            error,
            eventType: event.type,
          });
          throw error;
        }
      }

      logger.trace(`[${requestId}] Completing request processing`);
      return response;
    } catch (error) {
      logger.error(`[${requestId}] Error handling Slack event`, error);
      return c.text("Internal Server Error", 500);
    }
  };
};
