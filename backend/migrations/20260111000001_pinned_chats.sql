-- Add pinned chat support
ALTER TABLE chat_participants 
ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE;

-- Create index for pinned chats
CREATE INDEX idx_chat_participants_pinned ON chat_participants(user_id, is_pinned) WHERE is_pinned = TRUE;

-- Add comment
COMMENT ON COLUMN chat_participants.is_pinned IS 'Whether this chat is pinned for the user';
COMMENT ON COLUMN chat_participants.pinned_at IS 'When the chat was pinned';
