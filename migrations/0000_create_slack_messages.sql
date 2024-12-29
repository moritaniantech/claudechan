-- Migration: Create slack messages table
CREATE TABLE IF NOT EXISTS slack_messages (
    channel_timestamp TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    thread_timestamp TEXT,
    channel_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
); 