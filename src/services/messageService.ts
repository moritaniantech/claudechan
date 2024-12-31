import { DatabaseService } from "./databaseService";
import { AnthropicService } from "./anthropicService";
import { DatabaseRecord, MessageResponse, AnthropicMessage } from "../types";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errorHandler";
import { SlackClient } from "../utils/slackClient";

export class MessageService {
  constructor(
    private db: DatabaseService,
    private anthropic: AnthropicService,
    private botUserId: string,
    private slackClient: SlackClient
  ) {}

  private isFromBot(userId: string): boolean {
    return userId === this.botUserId;
  }

  private async postInitialResponse(
    channelId: string,
    threadTs?: string,
    timestamp?: string
  ): Promise<MessageResponse> {
    try {
      const threadReference = threadTs || timestamp;

      return await this.slackClient.postMessage(
        channelId,
        "回答を生成中です...",
        threadReference
      );
    } catch (error) {
      logger.error("Error posting initial response", error);
      throw new AppError("Failed to post initial response", error);
    }
  }

  private async updateMessage(
    channelId: string,
    ts: string,
    text: string
  ): Promise<void> {
    try {
      await this.slackClient.updateMessage(channelId, ts, text);
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

  async handleAppMention(event: any): Promise<void> {
    let initialResponse: MessageResponse | null = null;
    try {
      // Skip if the message is from the bot itself
      if (this.isFromBot(event.user)) {
        return;
      }

      initialResponse = await this.postInitialResponse(
        event.channel,
        event.thread_ts,
        event.ts
      );

      // Get conversation history
      const records = await this.db.getThreadMessages(
        event.thread_ts || event.ts
      );
      const messages = this.formatMessagesForAnthropic(records);

      // Add the current message to the conversation
      messages.push({
        role: "user",
        content: event.text,
      });

      // Get response from Anthropic
      const response = await this.anthropic.generateResponse(messages);

      // Store the conversation in the database
      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: event.ts,
        threadTimestamp: event.thread_ts || event.ts,
        text: event.text,
        role: "user",
      });

      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: initialResponse.ts!,
        threadTimestamp: event.thread_ts || event.ts,
        text: response,
        role: "assistant",
      });

      // Update the initial message with the response
      await this.updateMessage(event.channel, initialResponse.ts!, response);
      logger.debug("Updated message with response");
    } catch (error) {
      logger.error("Error in app mention processing", error);
      if (initialResponse) {
        await this.updateMessage(
          event.channel,
          initialResponse.ts!,
          "申し訳ありません。エラーが発生しました。"
        );
      }
      throw error;
    }
  }

  async handleMessage(event: any): Promise<void> {
    let initialResponse: MessageResponse | null = null;
    try {
      // Skip if the message is from the bot itself or if it's not in a thread
      if (this.isFromBot(event.user) || !event.thread_ts) {
        return;
      }

      initialResponse = await this.postInitialResponse(
        event.channel,
        event.thread_ts,
        event.ts
      );

      // Get conversation history
      const records = await this.db.getThreadMessages(event.thread_ts);
      const messages = this.formatMessagesForAnthropic(records);

      // Add the current message to the conversation
      messages.push({
        role: "user",
        content: event.text,
      });

      // Get response from Anthropic
      const response = await this.anthropic.generateResponse(messages);

      // Store the conversation in the database
      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: event.ts,
        threadTimestamp: event.thread_ts,
        text: event.text,
        role: "user",
      });

      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: initialResponse.ts!,
        threadTimestamp: event.thread_ts,
        text: response,
        role: "assistant",
      });

      // Update the initial message with the response
      await this.updateMessage(event.channel, initialResponse.ts!, response);
      logger.debug("Updated message with response");
    } catch (error) {
      logger.error("Error in message processing", error);
      if (initialResponse) {
        await this.updateMessage(
          event.channel,
          initialResponse.ts!,
          "申し訳ありません。エラーが発生しました。"
        );
      }
      throw error;
    }
  }
}
