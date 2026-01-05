-- Add refresh token support to sessions table
-- Migration: 20260104000001_refresh_tokens

-- Add refresh_token column to sessions
ALTER TABLE sessions 
ADD COLUMN refresh_token TEXT,
ADD COLUMN refresh_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for refresh token lookups
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);

-- Add comment
COMMENT ON COLUMN sessions.refresh_token IS 'Refresh token for obtaining new access tokens';
COMMENT ON COLUMN sessions.refresh_expires_at IS 'Expiration time for refresh token (typically 7-30 days)';
