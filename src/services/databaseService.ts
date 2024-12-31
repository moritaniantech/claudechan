import { DatabaseRecord } from "../types";
import { logger } from "../utils/logger";
import { AppError } from "../utils/errorHandler";

export class DatabaseService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async saveMessage(record: Omit<DatabaseRecord, "channelTimestamp">) {
    try {
      const channelTimestamp = `${record.channelId}-${record.timestamp}`;
      logger.info("Saving message to database", {
        channelTimestamp,
        ...record,
      });

      await this.db
        .prepare(
          `INSERT INTO chathistory (channelId, timestamp, threadTimestamp, text, role, channelTimestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          record.channelId,
          record.timestamp,
          record.threadTimestamp || null,
          record.text,
          record.role,
          channelTimestamp
        )
        .run();

      return channelTimestamp;
    } catch (error) {
      logger.error("Error saving message to database", error);
      throw new AppError("Failed to save message to database", error);
    }
  }

  async getThreadMessages(threadTs: string): Promise<DatabaseRecord[]> {
    try {
      logger.info("Fetching thread messages", { threadTs });

      const result = await this.db
        .prepare(
          `SELECT * FROM chathistory 
         WHERE timestamp = ? OR threadTimestamp = ?
         ORDER BY timestamp ASC`
        )
        .bind(threadTs, threadTs)
        .all();

      return (result.results as Record<string, unknown>[]).map((row) => ({
        channelId: String(row["channelId"]),
        timestamp: String(row["timestamp"]),
        threadTimestamp: row["threadTimestamp"]
          ? String(row["threadTimestamp"])
          : undefined,
        text: String(row["text"]),
        role: String(row["role"]) as "user" | "assistant",
        channelTimestamp: String(row["channelTimestamp"]),
      }));
    } catch (error) {
      logger.error("Error fetching thread messages", error);
      throw new AppError("Failed to fetch thread messages", error);
    }
  }
}
