-- =============================================
-- 002_complete_schema.sql
-- AUTHORITATIVE SCHEMA (DO NOT MODIFY)
-- This file reflects the live Supabase schema.
-- All future migrations must build on this.
-- =============================================
---- ============================================================================
-- ============================================================================
-- 002_core_schema.sql
-- Baseline schema (Supabase Auth-based)
-- Payments, Meta, WhatsApp intentionally excluded
-- ============================================================================

-- Required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. USERS (linked to auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  api_key TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON public.users(auth_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ============================================================================
-- 2. WORKSPACES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);

-- ============================================================================
-- 3. WORKSPACE MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
  ON public.workspace_members(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
  ON public.workspace_members(user_id);

-- ============================================================================
-- 4. AGENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o-mini',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  enabled BOOLEAN DEFAULT true,
  api_key TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON public.agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_enabled ON public.agents(enabled);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  platform TEXT DEFAULT 'website',
  author_name TEXT,
  content TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_agent_id ON public.comments(agent_id);
CREATE INDEX IF NOT EXISTS idx_comments_processed ON public.comments(processed);

-- ============================================================================
-- 6. MESSAGE LOGS (AI conversations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_logs_workspace_id
  ON public.message_logs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_message_logs_agent_id
  ON public.message_logs(agent_id);

-- ============================================================================
-- 7. SESSIONS (Application-level sessions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON public.sessions(user_id);

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================

-- USERS
DROP POLICY IF EXISTS "users_self_read" ON public.users;
CREATE POLICY "users_self_read"
  ON public.users FOR SELECT
  USING (auth.uid() = auth_uid);

DROP POLICY IF EXISTS "users_self_update" ON public.users;
CREATE POLICY "users_self_update"
  ON public.users FOR UPDATE
  USING (auth.uid() = auth_uid);

-- WORKSPACES
DROP POLICY IF EXISTS "workspace_member_access" ON public.workspaces;
CREATE POLICY "workspace_member_access"
  ON public.workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = workspaces.id
        AND u.auth_uid = auth.uid()
    )
  );

-- AGENTS
DROP POLICY IF EXISTS "agents_workspace_access" ON public.agents;
CREATE POLICY "agents_workspace_access"
  ON public.agents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = agents.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- COMMENTS
DROP POLICY IF EXISTS "comments_agent_access" ON public.comments;
CREATE POLICY "comments_agent_access"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      JOIN public.workspace_members wm ON wm.workspace_id = a.workspace_id
      JOIN public.users u ON u.id = wm.user_id
      WHERE a.id = comments.agent_id
        AND u.auth_uid = auth.uid()
    )
  );

-- MESSAGE LOGS
DROP POLICY IF EXISTS "message_logs_workspace_access" ON public.message_logs;
CREATE POLICY "message_logs_workspace_access"
  ON public.message_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = message_logs.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- 10. TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON public.users;
CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_workspaces_updated ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 11. AUTO-PROVISION USER + WORKSPACE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_workspace_id UUID;
BEGIN
  INSERT INTO public.users (auth_uid, email)
  VALUES (NEW.id, NEW.email)
  RETURNING id INTO v_user_id;

  INSERT INTO public.workspaces (owner_id, name)
  VALUES (v_user_id, 'My Workspace')
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- END OF 002
-- ============================================================================