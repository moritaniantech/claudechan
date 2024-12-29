import { D1Database } from "@cloudflare/workers-types";

export interface SlackMessage {
  channelTimestamp: string;
  timestamp: string;
  threadTimestamp?: string;
  channelId: string;
  text: string;
}

export class SlackMessageService {
  constructor(private db: D1Database) {}

  async saveMessage(message: SlackMessage): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO slack_messages (channel_timestamp, timestamp, thread_timestamp, channel_id, text)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        message.channelTimestamp,
        message.timestamp,
        message.threadTimestamp || null,
        message.channelId,
        message.text
      )
      .run();
  }

  async findThreadMessages(threadTimestamp: string): Promise<SlackMessage[]> {
    const result = await this.db
      .prepare(
        `SELECT channel_timestamp, timestamp, thread_timestamp, channel_id, text
         FROM slack_messages
         WHERE thread_timestamp = ?
         ORDER BY timestamp ASC`
      )
      .bind(threadTimestamp)
      .all();

    return (result.results || []).map((row: any) => ({
      channelTimestamp: row.channel_timestamp,
      timestamp: row.timestamp,
      threadTimestamp: row.thread_timestamp,
      channelId: row.channel_id,
      text: row.text,
    }));
  }
}
