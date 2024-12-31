import { SlackEvent, SlackWebhookResponse } from "../types";
import { MessageService } from "../services/messageService";

export class SlackEventService {
  constructor(private env: any) {}

  async handleEventCallback(event: SlackEvent): Promise<SlackWebhookResponse> {
    console.log("Event callback received:", {
      event_type: event.event?.type,
      user: event.event?.user,
      channel: event.event?.channel,
      timestamp: event.event?.ts,
    });

    switch (event.event?.type) {
      case "message":
        return this.handleMessageEvent(event);
      case "app_mention":
        return this.handleAppMention(event);
      default:
        console.warn("Unhandled event type:", event.event?.type);
        return { ok: true, message: "Event received but not handled" };
    }
  }

  private async handleMessageEvent(
    event: SlackEvent
  ): Promise<SlackWebhookResponse> {
    console.log("Message event received:", {
      user: event.event?.user,
      text: event.event?.text,
      channel: event.event?.channel,
    });

    // PDFファイルが添付されているか確認
    if (
      event.event?.files &&
      event.event.files.some((file: any) => file.mimetype === "application/pdf")
    ) {
      const pdfFile = event.event.files.find(
        (file: any) => file.mimetype === "application/pdf"
      );
      const messageService = new MessageService(
        this.env.db,
        this.env.anthropic,
        this.env.botUserId,
        this.env.slackClient
      );
      const analysisResult = await messageService.analyzePdfAttachment(
        pdfFile.url_private
      );

      // PDF解析結果をSlackに投稿
      await this.env.slackClient.postMessage(
        event.event.channel,
        `PDF解析結果: ${analysisResult}`,
        event.event.thread_ts
      );
      return { ok: true, message: "PDF processed" };
    }

    // メッセージイベントの処理をここに実装
    return { ok: true, message: "Message processed" };
  }

  private async handleAppMention(
    event: SlackEvent
  ): Promise<SlackWebhookResponse> {
    console.log("App mention received:", {
      user: event.event?.user,
      text: event.event?.text,
      channel: event.event?.channel,
    });

    // アプリメンションの処理をここに実装
    return { ok: true, message: "App mention processed" };
  }
}
