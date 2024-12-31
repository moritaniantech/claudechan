import { MessageService } from "../services/messageService";
import { DatabaseService } from "../services/databaseService";
import { AnthropicService } from "../services/anthropicService";
import { logger } from "../utils/logger";
import { SlackEvent } from "../types";

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

export const createSlackEventHandler = (env: any) => {
  const db = new DatabaseService(env.DB);
  const anthropic = new AnthropicService(env.ANTHROPIC_API_KEY);
  const messageService = new MessageService(db, anthropic, env.BOT_USER_ID);

  return async (c: any) => {
    try {
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

      // Handle events
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
              await messageService.handleAppMention(event, env.SLACK_CLIENT);
              break;

            case "message":
              if (!event.subtype) {
                logger.info("Handling message event", {
                  channel: event.channel,
                  user: event.user,
                  thread_ts: event.thread_ts,
                });
                await messageService.handleMessage(event, env.SLACK_CLIENT);
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

          return c.text("OK", 200);
        } catch (error) {
          logger.error("Error processing event", {
            error,
            eventType: event.type,
          });
          return c.text("Event processing failed", 500);
        }
      }

      logger.info("Unhandled request type", { type: body.type });
      return c.text("Unhandled request type", 400);
    } catch (error) {
      logger.error("Error handling Slack event", error);
      return c.text("Internal Server Error", 500);
    }
  };
};
