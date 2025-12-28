-- Migration 006: Add missing RLS policies for comments, direct_messages, message_logs
-- These tables have RLS enabled in migration 005 but lack actual policies
-- This migration enforces workspace-level isolation on read/write operations

-- ============================================================================
-- COMMENTS table policies
-- Comments are tied to agents -> workspaces
-- Only workspace members can view/create/update comments
-- ============================================================================

-- Select: members can read comments for agents in their workspace
CREATE POLICY comments_select_members ON comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agents a
    JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
    JOIN users u ON u.id = wm.user_id
    WHERE a.id = comments.agent_id AND u.auth_uid = auth.uid()::uuid
  )
);

-- Insert: members can create comments (external API usage, stored for workspace agents)
CREATE POLICY comments_insert_members ON comments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM agents a
    JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
    JOIN users u ON u.id = wm.user_id
    WHERE a.id = comments.agent_id AND u.auth_uid = auth.uid()::uuid
  )
);

-- Update: members can update comments (mark processed, add bot_reply)
CREATE POLICY comments_update_members ON comments FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agents a
    JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
    JOIN users u ON u.id = wm.user_id
    WHERE a.id = comments.agent_id AND u.auth_uid = auth.uid()::uuid
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM agents a
    JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
    JOIN users u ON u.id = wm.user_id
    WHERE a.id = comments.agent_id AND u.auth_uid = auth.uid()::uuid
  )
);

-- ============================================================================
-- DIRECT_MESSAGES table policies
-- DMs are tied to workspaces and agents
-- Only workspace members can view/create direct messages
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS direct_messages ENABLE ROW LEVEL SECURITY;

-- Select: members can read DMs from their workspace
CREATE POLICY direct_messages_select_members ON direct_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = direct_messages.workspace_id AND u.auth_uid = auth.uid()::uuid
  )
);

-- Insert: members can create DMs in their workspace
CREATE POLICY direct_messages_insert_members ON direct_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = direct_messages.workspace_id AND u.auth_uid = auth.uid()::uuid
  )
);

-- Update: members can update DMs in their workspace (e.g., update status)
CREATE POLICY direct_messages_update_members ON direct_messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = direct_messages.workspace_id AND u.auth_uid = auth.uid()::uuid
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = direct_messages.workspace_id AND u.auth_uid = auth.uid()::uuid
  )
);

-- ============================================================================
-- MESSAGE_LOGS table policies
-- Message logs are audit trails of conversations tied to workspaces
-- Only workspace members can view logs; typically read-only
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS message_logs ENABLE ROW LEVEL SECURITY;

-- Select: members can view message logs from their workspace
CREATE POLICY message_logs_select_members ON message_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = message_logs.workspace_id AND u.auth_uid = auth.uid()::uuid
  )
);

-- Insert: members can log messages (typically via server-side operations)
CREATE POLICY message_logs_insert_members ON message_logs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = message_logs.workspace_id AND u.auth_uid = auth.uid()::uuid
  )
);

-- ============================================================================
-- COMMENTS table also needs RLS enabled explicitly
-- ============================================================================

ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
