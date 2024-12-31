import { DatabaseService } from "./databaseService";
import { AnthropicService } from "./anthropicService";
import { DatabaseRecord, MessageResponse, AnthropicMessage } from "../types";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errorHandler";

export class MessageService {
  constructor(
    private db: DatabaseService,
    private anthropic: AnthropicService,
    private botUserId: string
  ) {}

  private isFromBot(userId: string): boolean {
    return userId === this.botUserId;
  }

  private async postInitialResponse(
    client: any,
    channelId: string,
    threadTs?: string
  ): Promise<MessageResponse> {
    try {
      return await client.chat.postMessage({
        channel: channelId,
        text: "回答を生成中です...",
        thread_ts: threadTs,
      });
    } catch (error) {
      logger.error("Error posting initial response", error);
      throw new AppError("Failed to post initial response", error);
    }
  }

  private async updateMessage(
    client: any,
    channelId: string,
    ts: string,
    text: string
  ): Promise<void> {
    try {
      await client.chat.update({
        channel: channelId,
        ts,
        text,
      });
    } catch (error) {
      logger.error("Error updating message", error);
      throw new AppError("Failed to update message", error);
    }
  }

  private formatMessagesForAnthropic(
    records: DatabaseRecord[]
  ): AnthropicMessage[] {
    return records.map((record) => ({
      role: record.role,
      content: record.text,
    }));
  }

  async handleAppMention(event: any, client: any): Promise<void> {
    try {
      if (this.isFromBot(event.user)) {
        logger.info("Ignoring message from bot", { userId: event.user });
        return;
      }

      logger.info("Starting app mention handling", {
        channel: event.channel,
        thread_ts: event.thread_ts,
      });

      const initialResponse = await this.postInitialResponse(
        client,
        event.channel,
        event.thread_ts
      );

      try {
        // Save the incoming message
        await this.db.saveMessage({
          channelId: event.channel,
          timestamp: event.ts,
          threadTimestamp: event.thread_ts,
          text: event.text,
          role: "user",
        });
        logger.debug("Saved user message to database");

        // Get thread messages if in a thread
        let messages: DatabaseRecord[];
        if (event.thread_ts) {
          messages = await this.db.getThreadMessages(event.thread_ts);
          logger.debug("Retrieved thread messages", { count: messages.length });
        } else {
          messages = [await this.db.getThreadMessages(event.ts)].flat();
          logger.debug("Retrieved initial message");
        }

        // Generate response
        const anthropicMessages = this.formatMessagesForAnthropic(messages);
        logger.debug("Formatted messages for Anthropic", {
          count: anthropicMessages.length,
        });

        const response = await this.anthropic.generateResponse(
          anthropicMessages
        );
        logger.debug("Received response from Anthropic");

        // Update the initial message with the response
        await this.updateMessage(
          client,
          event.channel,
          initialResponse.ts!,
          response
        );
        logger.debug("Updated message with response");

        // Save the assistant's response
        await this.db.saveMessage({
          channelId: event.channel,
          timestamp: initialResponse.ts!,
          threadTimestamp: event.thread_ts,
          text: response,
          role: "assistant",
        });
        logger.debug("Saved assistant response to database");
      } catch (error) {
        logger.error("Error in app mention processing", error);
        await this.updateMessage(
          client,
          event.channel,
          initialResponse.ts!,
          "エラーが発生しました"
        );
        throw error;
      }
    } catch (error) {
      logger.error("Critical error in app mention handling", error);
      throw new AppError("Failed to handle app mention", error);
    }
  }

  async handleMessage(event: any, client: any): Promise<void> {
    try {
      if (this.isFromBot(event.user)) {
        logger.info("Ignoring message from bot", { userId: event.user });
        return;
      }

      logger.info("Starting message handling", {
        channel: event.channel,
        thread_ts: event.thread_ts,
      });

      // Check if message is in a thread that we're tracking
      const threadMessages = await this.db.getThreadMessages(event.thread_ts);
      if (threadMessages.length === 0) {
        logger.info("Message is not in a tracked thread", {
          threadTs: event.thread_ts,
        });
        return;
      }

      const initialResponse = await this.postInitialResponse(
        client,
        event.channel,
        event.thread_ts
      );

      try {
        // Save the incoming message
        await this.db.saveMessage({
          channelId: event.channel,
          timestamp: event.ts,
          threadTimestamp: event.thread_ts,
          text: event.text,
          role: "user",
        });
        logger.debug("Saved user message to database");

        // Get all messages in the thread
        const messages = await this.db.getThreadMessages(event.thread_ts);
        logger.debug("Retrieved thread messages", { count: messages.length });

        // Generate response
        const anthropicMessages = this.formatMessagesForAnthropic(messages);
        logger.debug("Formatted messages for Anthropic", {
          count: anthropicMessages.length,
        });

        const response = await this.anthropic.generateResponse(
          anthropicMessages
        );
        logger.debug("Received response from Anthropic");

        // Update the initial message with the response
        await this.updateMessage(
          client,
          event.channel,
          initialResponse.ts!,
          response
        );
        logger.debug("Updated message with response");

        // Save the assistant's response
        await this.db.saveMessage({
          channelId: event.channel,
          timestamp: initialResponse.ts!,
          threadTimestamp: event.thread_ts,
          text: response,
          role: "assistant",
        });
        logger.debug("Saved assistant response to database");
      } catch (error) {
        logger.error("Error in message processing", error);
        await this.updateMessage(
          client,
          event.channel,
          initialResponse.ts!,
          "エラーが発生しました"
        );
        throw error;
      }
    } catch (error) {
      logger.error("Critical error in message handling", error);
      throw new AppError("Failed to handle message", error);
    }
  }
}
