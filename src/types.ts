// Slack Event Types
export type SlackEventType =
  | "url_verification"
  | "event_callback"
  | "message"
  | "app_mention";

// Base Event Interface
export interface SlackEvent {
  type: SlackEventType;
  event_id?: string;
  event_time?: number;
  team_id?: string;
  api_app_id?: string;
  event?: {
    type: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    [key: string]: any;
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
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
}
