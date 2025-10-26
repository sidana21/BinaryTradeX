-- Fix database schema to add missing email column
-- Run this SQL directly in NeonDB console if db:push fails

-- Step 1: Add email column if it doesn't exist (with default values)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN
        -- Add column without NOT NULL first
        ALTER TABLE users ADD COLUMN email TEXT;
        
        -- Update existing users with default emails
        UPDATE users 
        SET email = username || '@demo.local'
        WHERE email IS NULL;
        
        -- Now make it NOT NULL and UNIQUE
        ALTER TABLE users 
        ALTER COLUMN email SET NOT NULL;
        
        ALTER TABLE users 
        ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;

-- Verify the change
SELECT id, username, email FROM users LIMIT 10;
