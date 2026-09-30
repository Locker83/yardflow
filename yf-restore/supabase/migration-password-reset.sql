-- ============================================================
-- YardFlow Migration: Password Reset + Archive Analytics
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add email column to users table (for password reset)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Create archive table for moves (matches structure of moves table)
CREATE TABLE IF NOT EXISTS moves_archive (LIKE moves INCLUDING ALL);

-- Allow public access (matches your existing security model)
ALTER TABLE moves_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on moves_archive" ON moves_archive;
CREATE POLICY "Allow all on moves_archive" ON moves_archive FOR ALL USING (true) WITH CHECK (true);

-- 3. (Optional) Set Joshua's email so you can test password reset
-- Uncomment and edit if you want to set your admin email now:
-- UPDATE users SET email = 'Joshua.Locker@Pepsico.com' WHERE username = 'admin';

-- ============================================================
-- IMPORTANT: Configure Supabase Auth for password reset emails
-- ============================================================
-- After running this SQL, do these steps in your Supabase dashboard:
--
-- 1. Go to: Authentication → Providers → Email
--    - Make sure "Enable Email provider" is ON
--    - Disable "Confirm email" (since we're not using Auth signups,
--      only the password recovery flow)
--
-- 2. Go to: Authentication → URL Configuration
--    - Site URL: https://yardflowfay.com
--    - Redirect URLs: add https://yardflowfay.com/* (with the wildcard)
--
-- 3. Go to: Authentication → Users → Add user (manually, for each user
--    that needs reset access). Use the same email you put in the users
--    table. This creates the Supabase Auth account that the reset
--    email targets.
--    OR use a one-time SQL script to bulk-create auth users.
-- ============================================================
