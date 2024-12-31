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

  public async analyzePdfAttachment(pdfUrl: string): Promise<string> {
    try {
      // PDFをダウンロードして解析する処理をここに実装
      // 例: PDFをダウンロードし、AnthropicのAPIを使用して解析
      const response = await fetch(pdfUrl);
      const pdfData = await response.arrayBuffer();

      // AnthropicのAPIを使用してPDFを解析
      const analysisResult = await this.anthropic.analyzePdf(pdfData);

      return analysisResult;
    } catch (error) {
      logger.error("Error analyzing PDF attachment", error);
      throw new AppError("Failed to analyze PDF attachment", error);
    }
  }

  async handleAppMention(event: any): Promise<void> {
    let initialResponse: MessageResponse | null = null;
    try {
      // Skip if the message is from the bot itself
      if (this.isFromBot(event.user)) {
        return;
      }

      // スレッド内のメンションの場合は、直接処理を続行
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

      // PDFファイルが添付されているか確認
      if (
        event.files &&
        event.files.some((file: any) => file.mimetype === "application/pdf")
      ) {
        const pdfFile = event.files.find(
          (file: any) => file.mimetype === "application/pdf"
        );
        const analysisResult = await this.analyzePdfAttachment(
          pdfFile.url_private
        );

        // PDF解析結果をSlackに投稿
        await this.slackClient.postMessage(
          event.channel,
          `PDF解析結果: ${analysisResult}`,
          event.thread_ts
        );
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
