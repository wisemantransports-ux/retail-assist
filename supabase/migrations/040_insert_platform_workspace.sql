-- =====================================================
-- 0040_insert_platform_workspace.sql
-- Create the platform workspace for platform employees
-- =====================================================
-- 
-- Purpose:
--   Platform employees (invited by super_admin) must reference
--   a legitimate workspace in the workspaces table due to FK constraint.
--   
--   This creates the PLATFORM_WORKSPACE with a fixed ID.
--   Super admins use workspace_id = NULL (in users table).
--   Platform employees reference this workspace in employees table.
--
-- Idempotent: Uses ON CONFLICT DO NOTHING to handle re-runs
-- =====================================================

BEGIN;

-- Insert platform workspace
-- The ID is constant: 00000000-0000-0000-0000-000000000001
-- This matches PLATFORM_WORKSPACE_ID in app/lib/config/workspace.ts
INSERT INTO public.workspaces (
  id,
  owner_id,
  name,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  (SELECT id FROM public.users WHERE role = 'super_admin' LIMIT 1)::UUID,
  'Retail Assist Platform',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
