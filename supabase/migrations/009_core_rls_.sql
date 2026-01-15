-- =============================================
-- 009_core_rls.sql
-- Baseline Row-Level Security policies
-- Depends on schema 002 only
-- =============================================

-- ============================================================================
-- USERS
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_read ON public.users;
CREATE POLICY users_self_read
  ON public.users
  FOR SELECT
  USING (auth.uid() = auth_uid);

DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update
  ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_uid);

-- ============================================================================
-- WORKSPACES
-- ============================================================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspaces_member_read ON public.workspaces;
CREATE POLICY workspaces_member_read
  ON public.workspaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = workspaces.id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- WORKSPACE MEMBERS
-- ============================================================================

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_self_read ON public.workspace_members;
CREATE POLICY workspace_members_self_read
  ON public.workspace_members
  FOR SELECT
  USING (
    user_id = (
      SELECT id
      FROM public.users
      WHERE auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- END OF 009
-- ============================================================================