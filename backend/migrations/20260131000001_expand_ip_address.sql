-- Expand ip_address column to accommodate longer values
-- IPv6 with zone can be longer than 45 characters

ALTER TABLE login_attempts 
ALTER COLUMN ip_address TYPE VARCHAR(100);
