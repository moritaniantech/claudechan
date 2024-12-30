import { SlackEvent, SlackWebhookResponse } from "../types";

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
