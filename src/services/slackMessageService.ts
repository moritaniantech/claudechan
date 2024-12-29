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
        `INSERT INTO chathistory ("channelId", "timestamp", "thread-timestamp", "text", "channel-timestamp")
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        message.channelId,
        message.timestamp,
        message.threadTimestamp || null,
        message.text,
        message.channelTimestamp
      )
      .run();
  }

  async findThreadMessages(threadTimestamp: string): Promise<SlackMessage[]> {
    const result = await this.db
      .prepare(
        `SELECT "channel-timestamp" as channel_timestamp, 
                "timestamp",
                "thread-timestamp" as thread_timestamp,
                "channelId" as channel_id,
                "text"
         FROM chathistory
         WHERE "thread-timestamp" = ?
         ORDER BY "timestamp" ASC`
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
