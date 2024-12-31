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
        console.log(`PDFファイルの取得を開始: ${file.name}`);
        const response = await fetch(file.url_private);
        console.log("PDFファイルの取得完了");

        // Base64エンコード
        console.log("Base64エンコードを開始");
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        console.log("Base64エンコード完了");

        // PDFの内容を解析
        console.log("Anthropicによる解析を開始");
        const analysis = await this.anthropic.analyzePdfContent(
          base64,
          event.text || ""
        );
        console.log("Anthropicによる解析完了");

        // PDFの内容と解析結果を会話履歴に保存
        console.log("データベースへの保存を開始");
        await this.db.saveMessage({
          channelId: event.channel,
          timestamp: event.ts,
          threadTimestamp: event.thread_ts || event.ts,
          text: `PDFファイル「${file.name}」が共有されました。\n${
            event.text || ""
          }`,
          role: "user",
        });
        console.log("データベースへの保存完了");

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
        console.error("PDFファイル処理中にエラーが発生:", error);
        throw error;
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
    // Botからのメッセージは無視
    if (this.isFromBot(userId)) return;

    try {
      // スレッドIDが存在しない場合は処理を終了
      if (!threadTs) {
        logger.info("Skipping message without thread_ts");
        return;
      }

      // スレッド内のメッセージを確認
      const threadMessages = await this.db.getThreadMessages(threadTs);
      if (threadMessages.length === 0) {
        logger.info("Skipping message without existing thread history");
        return;
      }

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
      const messages = await this.db.getThreadMessages(threadTs);
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
        threadTimestamp: threadTs,
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
    const processId = crypto.randomUUID();
    logger.debug(`[${processId}] Starting app_mention processing`, {
      channel: event.channel,
      user: event.user,
      hasThread: !!event.thread_ts,
    });

    // PDFファイルが添付されている場合は専用の処理を行う
    if (event.files && event.files.length > 0) {
      logger.debug(`[${processId}] PDF files detected`, {
        fileCount: event.files.length,
      });
      const hasPdfProcessed = await this.processPdfFiles(event);
      if (hasPdfProcessed) {
        logger.info(`[${processId}] PDF processing completed`);
        return;
      }
    }

    let initialResponse: MessageResponse | null = null;
    try {
      // app_mentionの場合は常に応答
      logger.debug(`[${processId}] Posting initial response`);
      initialResponse = await this.postInitialResponse(
        event.channel,
        event.thread_ts,
        event.ts
      );

      if (!initialResponse.ts) {
        logger.error(
          `[${processId}] Failed to get timestamp from initial response`
        );
        throw new AppError(
          "Failed to get timestamp from initial response",
          null
        );
      }

      // 会話履歴の取得と応答生成
      logger.debug(`[${processId}] Fetching thread messages`);
      const messages = await this.db.getThreadMessages(
        event.thread_ts || event.ts
      );
      logger.debug(`[${processId}] Retrieved thread messages`, {
        count: messages.length,
      });

      const anthropicMessages = this.formatMessagesForAnthropic(messages);
      logger.debug(`[${processId}] Formatted messages for Anthropic`, {
        messageCount: anthropicMessages.length,
      });

      // 現在のメッセージを追加
      anthropicMessages.push({
        role: "user",
        content: event.text || "",
      });

      // Anthropic APIの応答を待機
      logger.debug(`[${processId}] Requesting Anthropic API response`);
      const response = await this.anthropic.generateResponse(anthropicMessages);
      logger.debug(`[${processId}] Received Anthropic API response`, {
        responseLength: response.length,
      });

      // メッセージの更新を実行
      logger.debug(`[${processId}] Updating Slack message`);
      await this.updateMessage(event.channel, initialResponse.ts, response);

      // 会話履歴の保存
      logger.debug(`[${processId}] Saving conversation history`);
      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: event.ts,
        threadTimestamp: event.thread_ts || event.ts,
        text: event.text || "",
        role: "user",
      });

      logger.info(
        `[${processId}] App mention processing completed successfully`
      );
    } catch (error) {
      logger.error(`[${processId}] Error in app mention processing`, error);

      // 初期メッセージが投稿されていた場合は、エラーメッセージに更新
      if (initialResponse?.ts) {
        try {
          await this.updateMessage(
            event.channel,
            initialResponse.ts,
            "申し訳ありません。メッセージの処理中にエラーが発生しました。しばらく待ってから再度お試しください。"
          );
        } catch (updateError) {
          logger.error(
            `[${processId}] Failed to update error message`,
            updateError
          );
        }
      }

      throw error;
    }
  }

  async handleMessage(event: any): Promise<void> {
    const processId = crypto.randomUUID();
    logger.debug(`[${processId}] Starting message processing`, {
      channel: event.channel,
      user: event.user,
      hasThread: !!event.thread_ts,
    });

    // Botからのメッセージは無視
    if (this.isFromBot(event.user)) {
      logger.info(`[${processId}] Ignoring bot message`);
      return;
    }

    // PDFファイルが添付されている場合は専用の処理を行う
    if (event.files && event.files.length > 0) {
      logger.debug(`[${processId}] PDF files detected`, {
        fileCount: event.files.length,
      });
      const hasPdfProcessed = await this.processPdfFiles(event);
      if (hasPdfProcessed) {
        logger.info(`[${processId}] PDF processing completed`);
        return;
      }
    }

    // スレッドIDが存在しない場合は処理を終了
    if (!event.thread_ts) {
      logger.info(`[${processId}] Skipping message without thread_ts`);
      return;
    }

    let initialResponse: MessageResponse | null = null;
    try {
      // スレッド内のメッセージを確認
      logger.debug(`[${processId}] Checking thread messages`);
      const threadMessages = await this.db.getThreadMessages(event.thread_ts);
      if (threadMessages.length === 0) {
        logger.info(
          `[${processId}] Skipping message without existing thread history`
        );
        return;
      }

      // スレッド履歴が存在する場合のみ応答
      logger.debug(`[${processId}] Posting initial response`);
      initialResponse = await this.postInitialResponse(
        event.channel,
        event.thread_ts,
        event.ts
      );

      if (!initialResponse.ts) {
        logger.error(
          `[${processId}] Failed to get timestamp from initial response`
        );
        throw new AppError(
          "Failed to get timestamp from initial response",
          null
        );
      }

      // 会話履歴の取得と応答生成
      logger.debug(`[${processId}] Fetching thread messages`);
      const messages = await this.db.getThreadMessages(event.thread_ts);
      logger.debug(`[${processId}] Retrieved thread messages`, {
        count: messages.length,
      });

      const anthropicMessages = this.formatMessagesForAnthropic(messages);
      logger.debug(`[${processId}] Formatted messages for Anthropic`, {
        messageCount: anthropicMessages.length,
      });

      // 現在のメッセージを追加
      anthropicMessages.push({
        role: "user",
        content: event.text || "",
      });

      // Anthropic APIの応答を待機
      logger.debug(`[${processId}] Requesting Anthropic API response`);
      const response = await this.anthropic.generateResponse(anthropicMessages);
      logger.debug(`[${processId}] Received Anthropic API response`, {
        responseLength: response.length,
      });

      // メッセージの更新を実行
      logger.debug(`[${processId}] Updating Slack message`);
      await this.updateMessage(event.channel, initialResponse.ts, response);

      // 会話履歴の保存
      logger.debug(`[${processId}] Saving conversation history`);
      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: event.ts,
        threadTimestamp: event.thread_ts,
        text: event.text || "",
        role: "user",
      });

      logger.info(`[${processId}] Message processing completed successfully`);
    } catch (error) {
      logger.error(`[${processId}] Error in message processing`, error);

      // 初期メッセージが投稿されていた場合は、エラーメッセージに更新
      if (initialResponse?.ts) {
        try {
          await this.updateMessage(
            event.channel,
            initialResponse.ts,
            "申し訳ありません。メッセージの処理中にエラーが発生しました。しばらく待ってから再度お試しください。"
          );
        } catch (updateError) {
          logger.error(
            `[${processId}] Failed to update error message`,
            updateError
          );
        }
      }

      throw error;
    }
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
