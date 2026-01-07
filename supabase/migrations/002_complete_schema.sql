-- =============================================
-- 002_complete_schema.sql
-- AUTHORITATIVE SCHEMA (DO NOT MODIFY)
-- This file reflects the live Supabase schema.
-- All future migrations must build on this.
-- =============================================
-- ============================================
-- RETAIL ASSIST — MVP CLEAN SCHEMA (FINAL)
-- ============================================

-- USERS
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  api_key TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- API KEY GENERATOR FUNCTION
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'sk_' || encode(gen_random_bytes(32), 'hex');
END;
$$;

-- API KEY TRIGGER
CREATE OR REPLACE FUNCTION public.set_user_api_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.api_key IS NULL THEN
    NEW.api_key := public.generate_api_key();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_user_api_key_trigger
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_user_api_key();

-- WORKSPACES
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_domain TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- WORKSPACE MEMBERS
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  UNIQUE (workspace_id, user_id)
);

-- AGENTS
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  greeting TEXT,
  fallback TEXT,
  model TEXT DEFAULT 'gpt-4o-mini',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- COMMENTS
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- DIRECT MESSAGES (INBOX)
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- AUTOMATION RULES
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  trigger_words TEXT[],
  reply_template TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- AI USAGE
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select
ON public.users
FOR SELECT
USING (id = auth.uid());

CREATE POLICY workspaces_select
ON public.workspaces
FOR SELECT
USING (
  owner = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = auth.uid()
  )
);

CREATE POLICY agents_access
ON public.agents
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = agents.workspace_id
      AND workspace_members.user_id = auth.uid()
  )
);

CREATE POLICY inbox_access
ON public.direct_messages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = direct_messages.workspace_id
      AND workspace_members.user_id = auth.uid()
  )
);