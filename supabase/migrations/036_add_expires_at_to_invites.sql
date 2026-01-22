-- Add missing expires_at column to employee_invites table
-- This migration adds the expires_at column that was supposed to be in 032
-- but wasn't applied because the table already existed

ALTER TABLE public.employee_invites 
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');

-- Create index on expires_at for expiration queries
CREATE INDEX IF NOT EXISTS idx_employee_invites_expires_at ON public.employee_invites(expires_at);

-- Create index on created_at for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_employee_invites_created_at ON public.employee_invites(created_at);

-- Update existing rows without expires_at to have a default (30 days from creation)
UPDATE public.employee_invites 
SET expires_at = created_at + interval '30 days' 
WHERE expires_at IS NULL;
