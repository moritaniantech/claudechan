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
    if (this.isFromBot(event.user)) {
      logger.info("Ignoring message from bot", { userId: event.user });
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

      // Get thread messages if in a thread
      let messages: DatabaseRecord[];
      if (event.thread_ts) {
        messages = await this.db.getThreadMessages(event.thread_ts);
      } else {
        messages = [await this.db.getThreadMessages(event.ts)].flat();
      }

      // Generate response
      const anthropicMessages = this.formatMessagesForAnthropic(messages);
      const response = await this.anthropic.generateResponse(anthropicMessages);

      // Update the initial message with the response
      await this.updateMessage(
        client,
        event.channel,
        initialResponse.ts!,
        response
      );

      // Save the assistant's response
      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: initialResponse.ts!,
        threadTimestamp: event.thread_ts,
        text: response,
        role: "assistant",
      });
    } catch (error) {
      logger.error("Error handling app mention", error);
      await this.updateMessage(
        client,
        event.channel,
        initialResponse.ts!,
        "エラーが発生しました"
      );
      throw error;
    }
  }

  async handleMessage(event: any, client: any): Promise<void> {
    if (this.isFromBot(event.user)) {
      logger.info("Ignoring message from bot", { userId: event.user });
      return;
    }

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

      // Get all messages in the thread
      const messages = await this.db.getThreadMessages(event.thread_ts);

      // Generate response
      const anthropicMessages = this.formatMessagesForAnthropic(messages);
      const response = await this.anthropic.generateResponse(anthropicMessages);

      // Update the initial message with the response
      await this.updateMessage(
        client,
        event.channel,
        initialResponse.ts!,
        response
      );

      // Save the assistant's response
      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: initialResponse.ts!,
        threadTimestamp: event.thread_ts,
        text: response,
        role: "assistant",
      });
    } catch (error) {
      logger.error("Error handling message", error);
      await this.updateMessage(
        client,
        event.channel,
        initialResponse.ts!,
        "エラーが発生しました"
      );
      throw error;
    }
  }
}
