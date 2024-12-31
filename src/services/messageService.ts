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

  private async handlePdfFile(file: any, event: any): Promise<boolean> {
    if (file.mimetype === "application/pdf") {
      logger.info("PDF file detected, processing...", {
        filename: file.name,
      });

      const response = await this.slackClient.downloadFile(file.url_private);

      if (!response.ok) {
        throw new Error("Failed to download PDF file");
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const analysis = await this.anthropic.analyzePdfContent(
        base64,
        event.text
      );

      await this.slackClient.postMessage(
        event.channel,
        `PDFファイル「${file.name}」の解析結果:\n${analysis}`,
        event.thread_ts || event.ts
      );
      return true;
    }
    return false;
  }

  private async processPdfFiles(event: any): Promise<boolean> {
    if (event.files && event.files.length > 0) {
      for (const file of event.files) {
        if (await this.handlePdfFile(file, event)) {
          return true;
        }
      }
    }
    return false;
  }

  private async processMessage(
    event: any,
    isAppMention: boolean = false
  ): Promise<void> {
    let initialResponse: MessageResponse | null = null;
    try {
      if (this.isFromBot(event.user) || (!isAppMention && !event.thread_ts)) {
        return;
      }

      if (await this.processPdfFiles(event)) {
        return;
      }

      initialResponse = await this.postInitialResponse(
        event.channel,
        event.thread_ts,
        event.ts
      );

      const records = await this.db.getThreadMessages(
        event.thread_ts || event.ts
      );
      const messages = this.formatMessagesForAnthropic(records);

      messages.push({
        role: "user",
        content: event.text,
      });

      const response = await this.anthropic.generateResponse(messages);

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

      await this.updateMessage(event.channel, initialResponse.ts!, response);
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

  async handleAppMention(event: any): Promise<void> {
    await this.processMessage(event, true);
  }

  async handleMessage(event: any): Promise<void> {
    await this.processMessage(event, false);
  }
}
