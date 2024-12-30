CREATE TABLE IF NOT EXISTS chathistory (
  "channelId" TEXT NOT NULL,
  "timestamp" TEXT NOT NULL,
  "threadTimestamp" TEXT,
  "text" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user',
  "channelTimestamp" TEXT PRIMARY KEY NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
