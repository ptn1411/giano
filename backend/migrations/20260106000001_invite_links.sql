-- Invite links table for groups and direct chats
CREATE TABLE invite_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) UNIQUE NOT NULL,
    type            VARCHAR(20) NOT NULL, -- 'group' or 'direct'
    chat_id         UUID REFERENCES chats(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at      TIMESTAMP WITH TIME ZONE,
    max_uses        INTEGER,
    current_uses    INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invite_links_code ON invite_links(code);
CREATE INDEX idx_invite_links_chat ON invite_links(chat_id);
CREATE INDEX idx_invite_links_created_by ON invite_links(created_by);
CREATE INDEX idx_invite_links_active ON invite_links(is_active) WHERE is_active = TRUE;

-- Invite link usage tracking
CREATE TABLE invite_link_uses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_link_id  UUID NOT NULL REFERENCES invite_links(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(invite_link_id, user_id)
);

CREATE INDEX idx_invite_link_uses_link ON invite_link_uses(invite_link_id);
CREATE INDEX idx_invite_link_uses_user ON invite_link_uses(user_id);
