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
  const messageService = new MessageService(db, anthropic, env.BOT_USER_ID);

  return async (c: Context) => {
    try {
      // Verify Slack request signature
      const signature = c.req.header("x-slack-signature");
      const timestamp = c.req.header("x-slack-request-timestamp");
      const rawBody = await c.req.raw.clone().text();

      if (!signature || !timestamp) {
        logger.error("Missing Slack signature or timestamp");
        return c.text("Unauthorized", 401);
      }

      if (!slackClient.verifySlackRequest(signature, timestamp, rawBody)) {
        logger.error("Invalid Slack signature");
        return c.text("Unauthorized", 401);
      }

      const body = (await c.req.json()) as SlackEventBody;
      logger.info("Received Slack event", {
        type: body.type,
        event: body.event?.type,
      });

      // Handle URL verification
      if (body.type === "url_verification" && body.challenge) {
        logger.info("Handling URL verification challenge");
        return c.text(body.challenge, 200);
      }

      // 即座に200を返す
      c.header("X-Slack-No-Retry", "1");
      const response = c.text("OK", 200);

      // 非同期で後続の処理を実行
      if (body.type === "event_callback" && body.event) {
        const event = body.event;
        logger.info("Processing event", { eventType: event.type });

        try {
          switch (event.type) {
            case "app_mention":
              logger.info("Handling app mention event", {
                channel: event.channel,
                user: event.user,
                thread_ts: event.thread_ts,
              });
              messageService
                .handleAppMention(event, slackClient)
                .catch((error) => {
                  logger.error("Error in app mention handler", error);
                });
              break;

            case "message":
              if (!event.subtype) {
                logger.info("Handling message event", {
                  channel: event.channel,
                  user: event.user,
                  thread_ts: event.thread_ts,
                });
                messageService
                  .handleMessage(event, slackClient)
                  .catch((error) => {
                    logger.error("Error in message handler", error);
                  });
              } else {
                logger.info("Ignoring message with subtype", {
                  subtype: event.subtype,
                });
              }
              break;

            default:
              logger.info("Ignoring unhandled event type", {
                type: event.type,
              });
          }
        } catch (error) {
          logger.error("Error processing event", {
            error,
            eventType: event.type,
          });
        }
      }

      return response;
    } catch (error) {
      logger.error("Error handling Slack event", error);
      return c.text("Internal Server Error", 500);
    }
  };
};
