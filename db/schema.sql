CREATE TABLE IF NOT EXISTS chathistory (
  "channelId" TEXT NOT NULL,
  "timestamp" TEXT NOT NULL,
  "threadTimestamp" TEXT,
  "text" TEXT,
  "channelTimestamp" TEXT PRIMARY KEY NOT NULL
);
