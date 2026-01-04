-- Bot Engine tables
-- Bots table
CREATE TABLE bots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    token           VARCHAR(255) UNIQUE NOT NULL,
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    webhook_url     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bots_token ON bots(token);
CREATE INDEX idx_bots_owner ON bots(owner_id);

-- Bot permissions table
CREATE TABLE bot_permissions (
    bot_id          UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    scope           VARCHAR(50) NOT NULL,
    PRIMARY KEY (bot_id, scope)
);

CREATE INDEX idx_bot_permissions_bot ON bot_permissions(bot_id);

-- Bot chat subscriptions table
CREATE TABLE bot_chats (
    bot_id          UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    added_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (bot_id, chat_id)
);

CREATE INDEX idx_bot_chats_bot ON bot_chats(bot_id);
CREATE INDEX idx_bot_chats_chat ON bot_chats(chat_id);
