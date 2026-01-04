-- Users table
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    username        VARCHAR(50) UNIQUE,
    avatar          TEXT,
    bio             TEXT,
    phone           VARCHAR(20),
    status          VARCHAR(20) DEFAULT 'offline',
    last_seen       TIMESTAMP WITH TIME ZONE,
    is_bot          BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);

-- Chats table
CREATE TABLE chats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(20) NOT NULL,
    name            VARCHAR(100),
    avatar          TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chats_type ON chats(type);
CREATE INDEX idx_chats_created_by ON chats(created_by);

-- Chat participants table
CREATE TABLE chat_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'member',
    unread_count    INTEGER DEFAULT 0,
    joined_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_chat_participants_chat ON chat_participants(chat_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);

-- Messages table
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    text            TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    is_edited       BOOLEAN DEFAULT FALSE,
    is_pinned       BOOLEAN DEFAULT FALSE,
    reply_to_id     UUID REFERENCES messages(id),
    delivery_status VARCHAR(20) DEFAULT 'sent',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_pinned ON messages(chat_id, is_pinned) WHERE is_pinned = TRUE;

-- Attachments table
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    size            BIGINT NOT NULL,
    url             TEXT NOT NULL,
    mime_type       VARCHAR(100),
    duration        INTEGER,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON attachments(message_id);

-- Reactions table
CREATE TABLE reactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji           VARCHAR(10) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON reactions(message_id);

-- Read receipts table
CREATE TABLE read_receipts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_read_receipts_message ON read_receipts(message_id);

-- Sessions table
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(500) UNIQUE NOT NULL,
    device_name     VARCHAR(100),
    device_type     VARCHAR(20),
    location        VARCHAR(100),
    ip_address      INET,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- User settings table
CREATE TABLE user_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Privacy Settings
    last_seen_visibility    VARCHAR(20) DEFAULT 'everyone',
    profile_photo_visibility VARCHAR(20) DEFAULT 'everyone',
    calls_visibility        VARCHAR(20) DEFAULT 'contacts',
    groups_visibility       VARCHAR(20) DEFAULT 'contacts',
    forwards_enabled        BOOLEAN DEFAULT TRUE,
    read_receipts_enabled   BOOLEAN DEFAULT TRUE,
    two_factor_enabled      BOOLEAN DEFAULT FALSE,
    
    -- Notification Settings
    message_notifications   BOOLEAN DEFAULT TRUE,
    group_notifications     BOOLEAN DEFAULT TRUE,
    channel_notifications   BOOLEAN DEFAULT TRUE,
    in_app_sounds          BOOLEAN DEFAULT TRUE,
    in_app_vibrate         BOOLEAN DEFAULT TRUE,
    in_app_preview         BOOLEAN DEFAULT TRUE,
    contact_joined_notify  BOOLEAN DEFAULT FALSE,
    
    -- Chat Settings
    send_by_enter          BOOLEAN DEFAULT TRUE,
    media_auto_download    VARCHAR(20) DEFAULT 'wifi',
    save_to_gallery        BOOLEAN DEFAULT FALSE,
    auto_play_gifs         BOOLEAN DEFAULT TRUE,
    auto_play_videos       BOOLEAN DEFAULT TRUE,
    raise_to_speak         BOOLEAN DEFAULT FALSE,
    
    -- Data Storage Settings
    keep_media             VARCHAR(20) DEFAULT '1month',
    auto_download_photos   BOOLEAN DEFAULT TRUE,
    auto_download_videos   BOOLEAN DEFAULT FALSE,
    auto_download_files    BOOLEAN DEFAULT FALSE,
    data_saver             BOOLEAN DEFAULT FALSE,
    
    -- Appearance Settings
    theme                  VARCHAR(20) DEFAULT 'system',
    accent_color           VARCHAR(20) DEFAULT '#6366f1',
    font_size              VARCHAR(20) DEFAULT 'medium',
    chat_background        VARCHAR(50) DEFAULT 'default',
    bubble_style           VARCHAR(20) DEFAULT 'rounded',
    animations_enabled     BOOLEAN DEFAULT TRUE,
    
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);

-- Inline keyboards table (for bot messages)
CREATE TABLE inline_keyboards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    row_index       INTEGER NOT NULL,
    button_index    INTEGER NOT NULL,
    text            VARCHAR(100) NOT NULL,
    callback_data   VARCHAR(100),
    url             TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inline_keyboards_message ON inline_keyboards(message_id);
