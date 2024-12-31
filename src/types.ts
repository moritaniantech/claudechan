// Slack Event Types
export type SlackEventType = "url_verification" | "message" | "app_mention";

// Base Event Interface
export interface SlackEvent {
  type: SlackEventType;
  event_id?: string;
  event_time?: number;
  team_id?: string;
  api_app_id?: string;
  event?: {
    type?: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    files?: SlackFile[];
  };
}

// Challenge Request
export interface SlackChallengeRequest extends SlackEvent {
  token: string;
  challenge: string;
  type: "url_verification";
}

// Challenge Response
export interface SlackChallengeResponse {
  challenge: string;
}

// General Response
export interface SlackWebhookResponse {
  ok: boolean;
  error?: string;
  message?: string;
}

// Environment Variables
export interface Env {
  DB: D1Database;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  ANTHROPIC_API_KEY: string;
  BOT_USER_ID: string;
}

export interface MessageResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  message?: {
    text: string;
    thread_ts?: string;
  };
}

export interface DatabaseRecord {
  channelId: string;
  timestamp: string;
  threadTimestamp?: string;
  text: string;
  role: "user" | "assistant";
  channelTimestamp: string;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ErrorResponse {
  error: string;
  details?: any;
}

export interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  url_private: string;
  filetype: string;
  size: number;
  created: number;
}
