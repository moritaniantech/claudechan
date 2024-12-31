// Slack APIと直接通信するためのカスタムクライアントを実装
import { Env } from "../types";

export class SlackClient {
  private token: string;
  private baseUrl = "https://slack.com/api";

  constructor(env: Env) {
    const token = env.SLACK_BOT_TOKEN;
    if (!token) {
      throw new Error("SLACK_BOT_TOKEN environment variable is not set");
    }
    this.token = token;
  }

  async postMessage(channel: string, text: string) {
    const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to post message: ${response.statusText}`);
    }

    return await response.json();
  }

  // 必要に応じて他のSlack APIメソッドを追加
}

export const createSlackClient = (env: Env) => {
  return new SlackClient(env);
};
