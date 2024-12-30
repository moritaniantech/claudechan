import { SlackChallengeRequest, SlackChallengeResponse } from "./types";

export interface Env {
  // 必要に応じて環境変数を追加
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const data = (await request.json()) as SlackChallengeRequest;

    // URL検証チャレンジに応答
    if (data.type === "url_verification") {
      const response: SlackChallengeResponse = {
        challenge: data.challenge,
      };
      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("OK", { status: 200 });
  },
};
