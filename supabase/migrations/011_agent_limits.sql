-- =============================================
-- 011_agents_workspace_rls.sql
-- Migration 011: RLS policies for inserts/updates
-- Builds on 002 and 010
-- =============================================

-- ============================================================================
-- 1. AGENTS: Ensure only workspace owners can insert
-- ============================================================================

DROP POLICY IF EXISTS "agents_insert_limit" ON public.agents;

CREATE POLICY "agents_insert_limit"
ON public.agents
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.users u ON u.id = w.owner_id
    WHERE w.id = workspace_id
      AND u.auth_uid = auth.uid()
  )
);

-- ============================================================================
-- 2. AGENTS: Ensure only workspace members can update their agents
-- ============================================================================

DROP POLICY IF EXISTS "agents_update_access" ON public.agents;

CREATE POLICY "agents_update_access"
ON public.agents
FOR UPDATE
TO public
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
-- 3. WORKSPACES: Ensure only owners can update workspace metadata
-- ============================================================================

DROP POLICY IF EXISTS "workspaces_owner_update" ON public.workspaces;

CREATE POLICY "workspaces_owner_update"
ON public.workspaces
FOR UPDATE
TO public
USING (
  owner_id = (
    SELECT id FROM public.users WHERE auth_uid = auth.uid()
  )
);

-- ============================================================================
-- 4. COMMENTS: Ensure only members can insert comments
-- ============================================================================

DROP POLICY IF EXISTS "comments_member_insert" ON public.comments;

CREATE POLICY "comments_member_insert"
ON public.comments
FOR INSERT
TO public
WITH CHECK (
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
-- 5. MESSAGE LOGS: Ensure only workspace members can insert logs
-- ============================================================================

DROP POLICY IF EXISTS "message_logs_member_insert" ON public.message_logs;

CREATE POLICY "message_logs_member_insert"
ON public.message_logs
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = message_logs.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

-- ============================================================================
-- END OF 011
-- ============================================================================