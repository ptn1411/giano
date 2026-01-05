-- Create table for BotFather messages
CREATE TABLE IF NOT EXISTS botfather_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'bot')),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching user's messages
CREATE INDEX idx_botfather_messages_user_id ON botfather_messages(user_id, created_at DESC);
