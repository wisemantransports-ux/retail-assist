-- =============================================
-- 011_agents_workspace_rls.sql
-- Migration 011: RLS policies for agents and workspace updates
-- Safe to run now; comments and message_logs policies deferred
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
    WHERE w.id = agents.workspace_id
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
-- 4. COMMENTS & MESSAGE_LOGS
-- ============================================================================

-- NOTE: RLS for comments and message_logs is deferred.
-- Apply these once the tables 'comments' and 'message_logs' exist.
-- DROP POLICY IF EXISTS "comments_member_insert" ON public.comments;
-- DROP POLICY IF EXISTS "message_logs_member_insert" ON public.message_logs;

-- ============================================================================
-- END OF 011 (safe version)
-- ============================================================================