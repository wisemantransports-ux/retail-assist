-- =============================================
-- 009_rls_policies.sql
-- Add refined Row-Level Security policies for 002 schema
-- =============================================

-- ============================================================================
-- USERS
-- ============================================================================

-- Users can view themselves
DROP POLICY IF EXISTS "users_self_read" ON public.users;
CREATE POLICY "users_self_read"
  ON public.users FOR SELECT
  USING (auth.uid() = auth_uid);

-- Users can update their own data
DROP POLICY IF EXISTS "users_self_update" ON public.users;
CREATE POLICY "users_self_update"
  ON public.users FOR UPDATE
  USING (auth.uid() = auth_uid);

-- ============================================================================
-- WORKSPACES
-- ============================================================================

DROP POLICY IF EXISTS "workspace_member_access" ON public.workspaces;
CREATE POLICY "workspace_member_access"
  ON public.workspaces FOR SELECT
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

DROP POLICY IF EXISTS "workspace_members_self_access" ON public.workspace_members;
CREATE POLICY "workspace_members_self_access"
  ON public.workspace_members FOR SELECT
  USING (
    user_id = (
      SELECT id FROM public.users WHERE auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- AGENTS
-- ============================================================================

DROP POLICY IF EXISTS "agents_workspace_access" ON public.agents;
CREATE POLICY "agents_workspace_access"
  ON public.agents FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = agents.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

DROP POLICY IF EXISTS "comments_agent_access" ON public.comments;
CREATE POLICY "comments_agent_access"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.workspace_members wm ON wm.workspace_id = a.workspace_id
      JOIN public.users u ON u.id = wm.user_id
      WHERE a.id = comments.agent_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- MESSAGE LOGS
-- ============================================================================

DROP POLICY IF EXISTS "message_logs_workspace_access" ON public.message_logs;
CREATE POLICY "message_logs_workspace_access"
  ON public.message_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = message_logs.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- END OF 009
-- ============================================================================