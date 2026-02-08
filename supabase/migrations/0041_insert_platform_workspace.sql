-- =====================================================
-- 0041_insert_platform_workspace.sql
-- Create PLATFORM WORKSPACE (deferred-safe)
-- =====================================================
--
-- Rules:
-- - workspaces.owner_id is NOT NULL
-- - owner MUST already exist in public.users
-- - On fresh DB (no users yet) → do NOTHING
-- - Workspace will be created automatically
--   once the first super_admin exists
--
-- Fully idempotent
-- =====================================================

BEGIN;

INSERT INTO public.workspaces (
  id,
  owner_id,
  name,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000001'::UUID,
  u.id,
  'Retail Assist Platform',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workspaces
  WHERE id = '00000000-0000-0000-0000-000000000001'::UUID
)
ORDER BY u.created_at ASC
LIMIT 1;

COMMIT;