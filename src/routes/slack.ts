import { MessageService } from "../services/messageService";
import { DatabaseService } from "../services/databaseService";
import { AnthropicService } from "../services/anthropicService";
import { logger } from "../utils/logger";

interface SlackEventBody {
  type: string;
  challenge?: string;
  event?: {
    type: string;
    subtype?: string;
    [key: string]: any;
  };
}

export const createSlackEventHandler = (env: any) => {
  const db = new DatabaseService(env.DB);
  const anthropic = new AnthropicService(env.ANTHROPIC_API_KEY);
  const messageService = new MessageService(db, anthropic, env.BOT_USER_ID);

  return async (request: Request): Promise<Response> => {
    try {
      const body = (await request.json()) as SlackEventBody;
      logger.info("Received Slack event", {
        type: body.type,
        event: body.event?.type,
      });

      // Handle URL verification
      if (body.type === "url_verification" && body.challenge) {
        return new Response(body.challenge, { status: 200 });
      }

      // Handle events
      if (body.type === "event_callback" && body.event) {
        const event = body.event;

        switch (event.type) {
          case "app_mention":
            await messageService.handleAppMention(event, env.SLACK_CLIENT);
            break;
          case "message":
            if (!event.subtype) {
              // Ignore message subtypes (like message_changed)
              await messageService.handleMessage(event, env.SLACK_CLIENT);
            }
            break;
          default:
            logger.info("Ignoring unhandled event type", { type: event.type });
        }

        return new Response("OK", { status: 200 });
      }

      return new Response("Unhandled request type", { status: 400 });
    } catch (error) {
      logger.error("Error handling Slack event", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
};
