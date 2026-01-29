-- Drop foreign key constraint on sender_id to allow bots to send messages
-- Bots are in the 'bots' table, not 'users' table, so the FK constraint fails

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
