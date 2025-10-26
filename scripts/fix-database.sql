-- CRITICAL FIX: Add missing email column to users table
-- Execute this SQL in NeonDB Console (SQL Editor) for your PRODUCTION database

-- Step 1: Add email column (allows NULL initially)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 2: Set default emails for existing users
UPDATE users 
SET email = username || '@trading.local'
WHERE email IS NULL OR email = '';

-- Step 3: Make email required and unique
ALTER TABLE users 
ALTER COLUMN email SET NOT NULL;

-- Step 4: Add unique constraint if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;

-- Verify the fix
SELECT id, username, email, demo_balance FROM users LIMIT 5;
