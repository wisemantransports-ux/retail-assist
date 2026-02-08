-- =============================================
-- 029_fix_get_user_access.sql
-- Schema-safe access resolution (NO users.role)
-- =============================================

BEGIN;

DROP FUNCTION IF EXISTS public.rpc_get_user_access();

CREATE OR REPLACE FUNCTION public.rpc_get_user_access()
RETURNS TABLE (
  user_id UUID,
  workspace_id UUID,
  role TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wm.user_id,
    wm.workspace_id,
    wm.role
  FROM public.workspace_members wm
  WHERE wm.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_user_access() TO authenticated;

COMMIT;