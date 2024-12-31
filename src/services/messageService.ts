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
    text: string,
    retryCount = 0
  ): Promise<void> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1秒

    try {
      await this.slackClient.updateMessage(channelId, ts, text);
      logger.info("Successfully updated Slack message", { channelId, ts });
    } catch (error) {
      logger.error("Error updating message", {
        error,
        retryCount,
        channelId,
        ts,
      });

      if (retryCount < MAX_RETRIES) {
        logger.info(
          `Retrying message update (${retryCount + 1}/${MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return this.updateMessage(channelId, ts, text, retryCount + 1);
      }

      throw new AppError(
        `Failed to update message after ${MAX_RETRIES} retries`,
        error
      );
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

      try {
        // PDFファイルをダウンロード
        const response = await this.slackClient.downloadFile(file.url_private);

        if (!response.ok) {
          throw new Error("Failed to download PDF file");
        }

        // Base64エンコード
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // PDFの内容を解析
        const analysis = await this.anthropic.analyzePdfContent(
          base64,
          event.text || ""
        );

        // PDFの内容と解析結果を会話履歴に保存
        await this.db.saveMessage({
          channelId: event.channel,
          timestamp: event.ts,
          threadTimestamp: event.thread_ts || event.ts,
          text: `PDFファイル「${file.name}」が共有されました。\n${
            event.text || ""
          }`,
          role: "user",
        });

        // Anthropicの応答を保存
        const anthropicMessageTs = new Date().getTime().toString();
        await this.db.saveMessage({
          channelId: event.channel,
          timestamp: anthropicMessageTs,
          threadTimestamp: event.thread_ts || event.ts,
          text: analysis,
          role: "assistant",
        });

        // 解析結果をSlackに送信
        await this.slackClient.postMessage(
          event.channel,
          `PDFファイル「${file.name}」の解析結果:\n${analysis}`,
          event.thread_ts || event.ts
        );

        return true;
      } catch (error) {
        logger.error("Error processing PDF file", {
          error,
          filename: file.name,
        });

        // エラーメッセージを送信
        await this.slackClient.postMessage(
          event.channel,
          "PDFファイルの処理中にエラーが発生しました。",
          event.thread_ts || event.ts
        );

        throw new AppError("Failed to process PDF file", error);
      }
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
    userId: string,
    text: string,
    channelId: string,
    timestamp: string,
    threadTs?: string
  ): Promise<void> {
    if (this.isFromBot(userId)) return;

    try {
      // 初期レスポンスを投稿
      const initialResponse = await this.postInitialResponse(
        channelId,
        threadTs,
        timestamp
      );

      if (!initialResponse.ts) {
        throw new AppError(
          "Failed to get timestamp from initial response",
          null
        );
      }

      // 会話履歴の取得
      const messages = await this.db.getThreadMessages(threadTs || timestamp);
      const anthropicMessages = this.formatMessagesForAnthropic(messages);

      // 現在のメッセージを追加
      anthropicMessages.push({
        role: "user",
        content: text,
      });

      // Anthropic APIの応答を待機
      const response = await this.anthropic.generateResponse(anthropicMessages);

      // メッセージの更新を実行（リトライ機能付き）
      await this.updateMessage(channelId, initialResponse.ts, response);

      // 会話履歴の保存
      await this.db.saveMessage({
        channelId,
        timestamp,
        threadTimestamp: threadTs || timestamp,
        text,
        role: "user",
      });
    } catch (error) {
      logger.error("Error processing message", {
        error,
        userId,
        channelId,
        threadTs,
      });

      // エラーメッセージを投稿
      if (timestamp) {
        await this.slackClient.postMessage(
          channelId,
          "申し訳ありません。メッセージの処理中にエラーが発生しました。しばらく待ってから再度お試しください。",
          threadTs || timestamp
        );
      }

      throw new AppError("Failed to process message", error);
    }
  }

  async handleAppMention(event: any): Promise<void> {
    // PDFファイルが添付されている場合は専用の処理を行う
    if (event.files && event.files.length > 0) {
      const hasPdfProcessed = await this.processPdfFiles(event);
      if (hasPdfProcessed) {
        return;
      }
    }

    await this.processMessage(
      event.user,
      event.text || "",
      event.channel,
      event.ts,
      event.thread_ts
    );
  }

  async handleMessage(event: any): Promise<void> {
    // PDFファイルが添付されている場合は専用の処理を行う
    if (event.files && event.files.length > 0) {
      const hasPdfProcessed = await this.processPdfFiles(event);
      if (hasPdfProcessed) {
        return;
      }
    }

    // 通常のメッセージ処理
    await this.processMessage(
      event.user,
      event.text || "",
      event.channel,
      event.ts,
      event.thread_ts
    );
  }

  private convertToAnthropicMessages(
    messages: DatabaseRecord[],
    currentMessage: string
  ): AnthropicMessage[] {
    return messages.map((message) => ({
      role: message.role,
      content: message.text,
    }));
  }
}
