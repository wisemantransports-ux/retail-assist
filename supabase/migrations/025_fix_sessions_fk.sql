-- 025_fix_sessions_fk.sql
-- Fix the sessions table foreign key constraint.
-- Currently it references auth.users(id), but it should reference public.users(id).
-- This matches the ID contract where sessions.user_id must be the internal canonical ID.

-- Drop the old foreign key constraint
ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;

-- Alter the column to allow NULL temporarily (if needed)
ALTER TABLE public.sessions
ALTER COLUMN user_id DROP NOT NULL;

-- Add the correct foreign key constraint
ALTER TABLE public.sessions
ADD CONSTRAINT sessions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.users(id) ON DELETE CASCADE;

-- Restore NOT NULL constraint
ALTER TABLE public.sessions
ALTER COLUMN user_id SET NOT NULL;
