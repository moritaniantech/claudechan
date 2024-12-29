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
    try {
      console.log("Attempting to save message to DB:", {
        channelId: message.channelId,
        timestamp: message.timestamp,
        threadTimestamp: message.threadTimestamp,
        channelTimestamp: message.channelTimestamp,
        textLength: message.text.length,
      });

      const stmt = this.db.prepare(
        `INSERT INTO chathistory (channelId, timestamp, threadTimestamp, text, channelTimestamp)
         VALUES (?, ?, ?, ?, ?)`
      );

      console.log("Prepared SQL statement:", {
        sql: stmt.toString(),
        params: [
          message.channelId,
          message.timestamp,
          message.threadTimestamp || null,
          message.text,
          message.channelTimestamp,
        ],
      });

      const result = await stmt
        .bind(
          message.channelId,
          message.timestamp,
          message.threadTimestamp || null,
          message.text,
          message.channelTimestamp
        )
        .run();

      console.log("Database insert result:", {
        success: true,
        meta: result.meta,
      });
    } catch (error) {
      console.error("Error saving message to DB:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        message: {
          channelId: message.channelId,
          timestamp: message.timestamp,
          threadTimestamp: message.threadTimestamp,
          channelTimestamp: message.channelTimestamp,
        },
      });
      throw error;
    }
  }

  async findThreadMessages(threadTimestamp: string): Promise<SlackMessage[]> {
    try {
      console.log("Attempting to find thread messages:", {
        threadTimestamp,
      });
      const stmt = this.db.prepare(
        `SELECT channelTimestamp as channel_timestamp,
                timestamp,
                threadTimestamp as thread_timestamp,
                channelId as channel_id,
                text
         FROM chathistory
         WHERE threadTimestamp = ? OR timestamp = ?
         ORDER BY timestamp ASC`
      );

      console.log("Prepared SQL statement:", {
        sql: stmt.toString(),
        params: [threadTimestamp],
      });

      const result = await stmt.bind(threadTimestamp).all();

      console.log("Database query result:", {
        success: true,
        rowCount: result.results?.length || 0,
        meta: result.meta,
      });

      const messages = (result.results || []).map((row: any) => ({
        channelTimestamp: row.channel_timestamp,
        timestamp: row.timestamp,
        threadTimestamp: row.thread_timestamp,
        channelId: row.channel_id,
        text: row.text,
      }));

      console.log("Processed thread messages:", {
        count: messages.length,
        timestamps: messages.map((m) => m.timestamp),
      });

      return messages;
    } catch (error) {
      console.error("Error finding thread messages:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        threadTimestamp,
      });
      throw error;
    }
  }
}
