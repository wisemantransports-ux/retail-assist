-- Migration 007: Enable RLS and create policies for automation_rules table
-- This migration enforces workspace-level access control on automation rules
-- Non-destructive: Uses DROP IF EXISTS before CREATE to allow re-running

-- ============================================================================
-- AUTOMATION_RULES RLS ENFORCEMENT
-- ============================================================================
-- Purpose:
--   - Ensure only workspace members can read automation rules
--   - Ensure only workspace admins (or owners) can create, update, delete rules
--   - Leverage workspace_members and workspace subscription status
--   - Allow service-role key to bypass all policies (default Supabase behavior)
--
-- Patterns used:
--   - Members can SELECT rules in their workspace
--   - Admins only can INSERT/UPDATE/DELETE (subscription_status check in app layer)
--   - Uses auth.uid()::uuid matching against users.auth_uid
-- ============================================================================

-- Enable RLS on automation_rules table
-- This is idempotent; safe to re-run
ALTER TABLE IF EXISTS automation_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT policy: Allow workspace members to read rules in their workspace
-- ============================================================================
-- Rationale:
--   - Members need to see what rules are configured
--   - Rules belong to workspaces via workspace_id
--   - User must be in workspace_members to access
--
DROP POLICY IF EXISTS automation_rules_select_members ON automation_rules;

CREATE POLICY automation_rules_select_members ON automation_rules FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = automation_rules.workspace_id
    AND u.auth_uid = auth.uid()::uuid
  )
);

-- ============================================================================
-- INSERT policy: Allow workspace admins to create rules
-- ============================================================================
-- Rationale:
--   - Only admins (and owner) should create automation rules
--   - Rules must be created in user's workspace
--   - Workspace subscription_status is checked in API layer (checkWorkspaceActive)
--   - This policy ensures authorization, not subscription validity
--
DROP POLICY IF EXISTS automation_rules_insert_admin ON automation_rules;

CREATE POLICY automation_rules_insert_admin ON automation_rules FOR INSERT WITH CHECK (
  -- User must be workspace admin or owner
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = automation_rules.workspace_id
    AND u.auth_uid = auth.uid()::uuid
    AND wm.role = 'admin'
  )
  OR
  -- Or be the workspace owner
  EXISTS (
    SELECT 1 FROM workspaces w
    JOIN users u ON u.id = w.owner_id
    WHERE w.id = automation_rules.workspace_id
    AND u.auth_uid = auth.uid()::uuid
  )
);

-- ============================================================================
-- UPDATE policy: Allow workspace admins to update rules
-- ============================================================================
-- Rationale:
--   - Only admins should modify rules
--   - Same access control as INSERT
--   - Both USING and WITH CHECK must pass for security
--
DROP POLICY IF EXISTS automation_rules_update_admin ON automation_rules;

CREATE POLICY automation_rules_update_admin ON automation_rules FOR UPDATE USING (
  -- Verify current user can read this rule (implied access)
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = automation_rules.workspace_id
    AND u.auth_uid = auth.uid()::uuid
  )
) WITH CHECK (
  -- Verify current user is admin/owner to modify
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = automation_rules.workspace_id
    AND u.auth_uid = auth.uid()::uuid
    AND wm.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM workspaces w
    JOIN users u ON u.id = w.owner_id
    WHERE w.id = automation_rules.workspace_id
    AND u.auth_uid = auth.uid()::uuid
  )
);

-- ============================================================================
-- DELETE policy: Allow workspace admins to delete rules
-- ============================================================================
-- Rationale:
--   - Only admins should delete rules
--   - USING clause checks if current user can delete this rule
--   - Same pattern as UPDATE
--
DROP POLICY IF EXISTS automation_rules_delete_admin ON automation_rules;

CREATE POLICY automation_rules_delete_admin ON automation_rules FOR DELETE USING (
  -- User must be workspace admin or owner
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = automation_rules.workspace_id
    AND u.auth_uid = auth.uid()::uuid
    AND wm.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM workspaces w
    JOIN users u ON u.id = w.owner_id
    WHERE w.id = automation_rules.workspace_id
    AND u.auth_uid = auth.uid()::uuid
  )
);

-- ============================================================================
-- Notes
-- ============================================================================
--
-- Service-role key bypass:
--   The service-role key (used by app API servers) automatically bypasses all RLS policies.
--   No explicit "FORCE" policy needed; Supabase handles this.
--
-- Subscription gating:
--   Workspace subscription_status (active/pending/etc) is validated in the API layer
--   via checkWorkspaceActive(). RLS policies enforce authorization only, not subscription status.
--
-- Re-running this migration:
--   All policies use DROP IF EXISTS before CREATE, making this migration safe to re-run.
--   No errors if policies already exist.
--
-- Comparison to agents:
--   automation_rules follows the same pattern as agents (admin-only writes).
--   agents also use is_workspace_active() check, but that's in the policy itself.
--   For consistency with automation_rules API layer validation, we delegate subscription checks to app code.
