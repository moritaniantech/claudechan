CREATE TABLE IF NOT EXISTS chathistory (
  "channelId" TEXT NOT NULL,
  "timestamp" TEXT NOT NULL,
  "thread-timestamp" TEXT NOT NULL,
  "text" TEXT,
  "channel-timestamp" TEXT PRIMARY KEY NOT NULL
);
