-- Add sender_type column to messages table
-- This column distinguishes between user and bot senders
-- Default is 'user' for backward compatibility with existing messages

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'user';

-- Create index for efficient filtering by sender type
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);

-- Update existing messages to have sender_type = 'user'
UPDATE messages SET sender_type = 'user' WHERE sender_type IS NULL;
