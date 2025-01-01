import { DatabaseService } from "./databaseService";
import { AnthropicService } from "./anthropicService";
import { DatabaseRecord, MessageResponse, AnthropicMessage } from "../types";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errorHandler";
import { SlackClient } from "../utils/slackClient";
import { Buffer } from "buffer";
import { Env } from "../types";

export class MessageService {
  constructor(
    private db: DatabaseService,
    private anthropic: AnthropicService,
    private botUserId: string,
    private slackClient: SlackClient,
    private env: Env
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
      content: [{ type: "text", text: record.text }],
    }));
  }

  private async handlePdfFile(file: any, event: any): Promise<boolean> {
    if (file.mimetype === "application/pdf") {
      logger.info("PDF file detected, processing...", {
        filename: file.name,
        fileSize: file.size,
      });

      try {
        logger.info(`PDFファイルの取得を開始: ${file.name}`);
        const response = await fetch(file.url_private, {
          headers: {
            Authorization: `Bearer ${this.env.SLACK_BOT_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        logger.info("PDFファイルの取得完了");

        // Base64エンコード
        logger.info("Base64エンコードを開始");
        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error("Empty PDF file received");
        }

        const base64 = Buffer.from(arrayBuffer).toString("base64");
        if (!base64) {
          throw new Error("Failed to encode PDF to Base64");
        }
        logger.info("Base64エンコード完了", {
          encodedLength: base64.length,
        });

        // PDFの内容を解析
        logger.info("Anthropicによる解析を開始");
        const analysis = await this.anthropic.analyzePdfContent(
          base64,
          event.text || ""
        );
        logger.info("Anthropicによる解析完了");

        // PDFの内容と解析結果を会話履歴に保存
        logger.info("データベースへの保存を開始");
        await this.db.saveMessage({
          channelId: event.channel,
          timestamp: event.ts,
          threadTimestamp: event.thread_ts || event.ts,
          text: `PDFファイル「${file.name}」が共有されました。\n${
            event.text || ""
          }`,
          role: "user",
        });
        logger.info("データベースへの保存完了");

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

  async handleAppMention(event: any): Promise<void> {
    logger.debug(`Starting app_mention processing`, {
      channel: event.channel,
      user: event.user,
      hasThread: !!event.thread_ts,
    });

    // PDFファイルが添付されている場合は専用の処理を行う
    if (event.files && event.files.length > 0) {
      logger.debug(`PDF files detected`, {
        fileCount: event.files.length,
      });
      const hasPdfProcessed = await this.processPdfFiles(event);
      if (hasPdfProcessed) {
        logger.info(`PDF processing completed`);
        return;
      }
    }

    let initialResponse: MessageResponse | null = null;
    try {
      // app_mentionの場合は常に応答
      logger.debug(`Posting initial response`);
      initialResponse = await this.postInitialResponse(
        event.channel,
        event.thread_ts,
        event.ts
      );

      if (!initialResponse.ts) {
        logger.error(`Failed to get timestamp from initial response`);
        throw new AppError(
          "Failed to get timestamp from initial response",
          null
        );
      }

      // 会話履歴の取得と応答生成
      logger.debug(`Fetching thread messages`);
      const messages = await this.db.getThreadMessages(
        event.thread_ts || event.ts
      );
      logger.debug(`Retrieved thread messages`, {
        count: messages.length,
      });

      const anthropicMessages = this.formatMessagesForAnthropic(messages);
      logger.debug(`Formatted messages for Anthropic`, {
        messageCount: anthropicMessages.length,
      });

      // 現在のメッセージを追加
      anthropicMessages.push({
        role: "user",
        content: [{ type: "text", text: event.text || "" }],
      });

      // Anthropic APIの応答を待機
      logger.debug(`Requesting Anthropic API response`);
      const response = await this.anthropic.generateResponse(anthropicMessages);
      logger.debug(`Received Anthropic API response`, {
        responseLength: response.length,
      });

      // メッセージの更新を実行
      logger.debug(`Updating Slack message`);
      await this.updateMessage(event.channel, initialResponse.ts, response);

      // 会話履歴の保存
      logger.debug(`Saving conversation history`);
      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: event.ts,
        threadTimestamp: event.thread_ts || event.ts,
        text: event.text || "",
        role: "user",
      });

      logger.info(`App mention processing completed successfully`);
    } catch (error) {
      logger.error(`Error in app mention processing`, error);

      // 初期メッセージが投稿されていた場合は、エラーメッセージに更新
      if (initialResponse?.ts) {
        try {
          await this.updateMessage(
            event.channel,
            initialResponse.ts,
            "申し訳ありません。メッセージの処理中にエラーが発生しました。しばらく待ってから再度お試しください。"
          );
        } catch (updateError) {
          logger.error(`Failed to update error message`, updateError);
        }
      }

      throw error;
    }
  }

  async handleMessage(event: any): Promise<void> {
    logger.debug(`Starting message processing`, {
      channel: event.channel,
      user: event.user,
      hasThread: !!event.thread_ts,
    });

    // Botからのメッセージは無視
    if (this.isFromBot(event.user)) {
      logger.info(`Ignoring bot message`);
      return;
    }

    // PDFファイルが添付されている場合は専用の処理を行う
    if (event.files && event.files.length > 0) {
      logger.debug(`PDF files detected`, {
        fileCount: event.files.length,
      });
      const hasPdfProcessed = await this.processPdfFiles(event);
      if (hasPdfProcessed) {
        logger.info(`PDF processing completed`);
        return;
      }
    }

    // スレッドIDが存在しない場合は処理を終了
    if (!event.thread_ts) {
      logger.info(`Skipping message without thread_ts`);
      return;
    }

    let initialResponse: MessageResponse | null = null;
    try {
      // スレッド内のメッセージを確認
      logger.debug(`Checking thread messages`);
      const threadMessages = await this.db.getThreadMessages(event.thread_ts);
      if (threadMessages.length === 0) {
        logger.info(`Skipping message without existing thread history`);
        return;
      }

      // スレッド履歴が存在する場合のみ応答
      logger.debug(`Posting initial response`);
      initialResponse = await this.postInitialResponse(
        event.channel,
        event.thread_ts,
        event.ts
      );

      if (!initialResponse.ts) {
        logger.error(`Failed to get timestamp from initial response`);
        throw new AppError(
          "Failed to get timestamp from initial response",
          null
        );
      }

      // 会話履歴の取得と応答生成
      logger.debug(`Fetching thread messages`);
      const messages = await this.db.getThreadMessages(event.thread_ts);
      logger.debug(`Retrieved thread messages`, {
        count: messages.length,
      });

      const anthropicMessages = this.formatMessagesForAnthropic(messages);
      logger.debug(`Formatted messages for Anthropic`, {
        messageCount: anthropicMessages.length,
      });

      // 現在のメッセージを追加
      anthropicMessages.push({
        role: "user",
        content: [{ type: "text", text: event.text || "" }],
      });

      // メッセージにBotのメンションが含まれている場合は無視
      if (event.text.includes(`<@${this.botUserId}>`)) {
        logger.info("Skipping message with bot mention");
        return;
      }

      // Anthropic APIの応答を待機
      logger.debug(`Requesting Anthropic API response`);
      const response = await this.anthropic.generateResponse(anthropicMessages);
      logger.debug(`Received Anthropic API response`, {
        responseLength: response.length,
      });

      // メッセージの更新を実行
      logger.debug(`Updating Slack message`);
      await this.updateMessage(event.channel, initialResponse.ts, response);

      // 会話履歴の保存
      logger.debug(`Saving conversation history`);
      await this.db.saveMessage({
        channelId: event.channel,
        timestamp: event.ts,
        threadTimestamp: event.thread_ts,
        text: event.text || "",
        role: "user",
      });

      logger.info(`Message processing completed successfully`);
    } catch (error) {
      logger.error(`Error in message processing`, error);

      // 初期メッセージが投稿されていた場合は、エラーメッセージに更新
      if (initialResponse?.ts) {
        try {
          await this.updateMessage(
            event.channel,
            initialResponse.ts,
            "申し訳ありません。メッセージの処理中にエラーが発生しました。しばらく待ってから再度お試しください。"
          );
        } catch (updateError) {
          logger.error(`Failed to update error message`, updateError);
        }
      }

      throw error;
    }
  }
}
