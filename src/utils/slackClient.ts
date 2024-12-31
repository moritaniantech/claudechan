// Slack APIと直接通信するためのカスタムクライアントを実装
import { Env } from "../types";

interface SlackAPIResponse {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

export class SlackClient {
  private token: string;
  private signingSecret: string;
  private baseUrl = "https://slack.com/api";

  constructor(env: Env) {
    const token = env.SLACK_BOT_TOKEN;
    const signingSecret = env.SLACK_SIGNING_SECRET;

    if (!token) {
      throw new Error("SLACK_BOT_TOKEN environment variable is not set");
    }
    if (!signingSecret) {
      throw new Error("SLACK_SIGNING_SECRET environment variable is not set");
    }
    this.token = token;
    this.signingSecret = signingSecret;
  }

  async verifySlackRequest(
    signature: string,
    timestamp: string,
    body: string
  ): Promise<boolean> {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;

    if (parseInt(timestamp) < fiveMinutesAgo) {
      return false;
    }

    const sigBasestring = `v0:${timestamp}:${body}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(sigBasestring)
    );
    const mySignature =
      "v0=" +
      [...new Uint8Array(sig)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return mySignature === signature;
  }

  async postMessage(channel: string, text: string, thread_ts?: string) {
    const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text,
        thread_ts,
      }),
    });

    const data = (await response.json()) as SlackAPIResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        `Failed to post message: ${data.error || response.statusText}`
      );
    }

    return data;
  }

  async updateMessage(channel: string, ts: string, text: string) {
    const response = await fetch(`${this.baseUrl}/chat.update`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        ts,
        text,
      }),
    });

    const data = (await response.json()) as SlackAPIResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        `Failed to update message: ${data.error || response.statusText}`
      );
    }

    return data;
  }

  async downloadFile(url: string): Promise<Response> {
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
  }

  // 必要に応じて他のSlack APIメソッドを追加
}

export const createSlackClient = (token: string, signingSecret: string) => {
  return new SlackClient({
    SLACK_BOT_TOKEN: token,
    SLACK_SIGNING_SECRET: signingSecret,
  } as Env);
};
