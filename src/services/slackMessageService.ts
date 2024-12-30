import { D1Database } from "@cloudflare/workers-types";

export interface SlackMessage {
  channelTimestamp: string;
  timestamp: string;
  threadTimestamp?: string;
  channelId: string;
  text: string;
  role: string;
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
        role: message.role,
        textLength: message.text.length,
      });

      const stmt = this.db.prepare(
        `INSERT INTO chathistory (
            channelId, 
            timestamp, 
            threadTimestamp, 
            text,
            role, 
            channelTimestamp,
            createdAt
         )
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      );

      console.log("Prepared SQL statement:", {
        sql: stmt.toString(),
        params: [
          message.channelId,
          message.timestamp,
          message.threadTimestamp || null,
          message.text,
          message.role,
          message.channelTimestamp,
        ],
      });

      const result = await stmt
        .bind(
          message.channelId,
          message.timestamp,
          message.threadTimestamp || null,
          message.text,
          message.role,
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
          role: message.role,
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
        `SELECT 
            channelTimestamp as channelTimestamp,
            timestamp,
            threadTimestamp as threadTimestamp,
            channelId as channelId,
            text,
            role,
            datetime(createdAt, '+9 hours') as createdAtJst
         FROM chathistory
         WHERE threadTimestamp = ?
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
        channelTimestamp: row.channelTimestamp,
        timestamp: row.timestamp,
        threadTimestamp: row.threadTimestamp,
        channelId: row.channelId,
        text: row.text,
        role: row.role,
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
