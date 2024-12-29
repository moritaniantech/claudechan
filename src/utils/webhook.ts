import { CloudflareBindings } from "../types";
import { SlackMessage } from "../services/slackMessageService";

interface WebhookPayload {
  slackEvent: any;
  threadMessages: SlackMessage[];
}

export async function sendToWebhook(
  slackEvent: any,
  threadMessages: SlackMessage[],
  env: CloudflareBindings
) {
  try {
    console.log("Preparing webhook request:", {
      hasWebhookUrl: !!env.MAKE_WEBHOOK_URL,
      timestamp: new Date().toISOString(),
    });

    if (!env.MAKE_WEBHOOK_URL) {
      console.error("Webhook URLが設定されていません", {
        timestamp: new Date().toISOString(),
      });
      throw new Error(
        "Missing required environment variable: MAKE_WEBHOOK_URL"
      );
    }

    const payload: WebhookPayload = {
      slackEvent,
      threadMessages,
    };

    console.log("Sending request to webhook with payload size:", {
      payloadSize: JSON.stringify(payload).length,
      threadMessagesCount: threadMessages.length,
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(env.MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("Received response from webhook:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString(),
    });

    const responseText = await response.text();
    console.log("Raw response text:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log("Parsed response data:", {
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to parse webhook response as JSON:", {
        responseText,
        error: e instanceof Error ? e.message : "Unknown parsing error",
        timestamp: new Date().toISOString(),
      });
      responseData = responseText;
    }

    if (!response.ok) {
      const error = `Webhook error: ${response.status} ${response.statusText}`;
      console.error(error, {
        responseData,
        timestamp: new Date().toISOString(),
      });
      return {
        ok: false,
        error,
      };
    }

    console.log("Successfully sent data to webhook", {
      timestamp: new Date().toISOString(),
    });
    return {
      ok: true,
      data: responseData,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Webhook call failed:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return {
      ok: false,
      error: errorMessage,
    };
  }
}
