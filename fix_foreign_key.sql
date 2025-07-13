-- Quick fix to remove foreign key constraint
-- Run this in Supabase SQL Editor

-- Drop the foreign key constraint that's causing the issue
ALTER TABLE film_projects DROP CONSTRAINT IF EXISTS film_projects_user_id_fkey;

-- Disable RLS for all film tables
ALTER TABLE film_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE characters DISABLE ROW LEVEL SECURITY;
ALTER TABLE scripts DISABLE ROW LEVEL SECURITY;
ALTER TABLE shots DISABLE ROW LEVEL SECURITY;
ALTER TABLE storyboards DISABLE ROW LEVEL SECURITY;