-- Add username column to bots table
ALTER TABLE bots ADD COLUMN username TEXT UNIQUE;

-- Create index for username search
CREATE INDEX idx_bots_username ON bots(username);

-- Update existing bots to have a default username ending with 'bot'
UPDATE bots SET username = LOWER(REPLACE(name, ' ', '_')) || '_bot' WHERE username IS NULL;
