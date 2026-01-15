---- =============================================
-- 013_agent_settings_rls.sql
-- Adds agent-specific settings and RLS policies
-- =============================================

-- 1. AGENT SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agent_id, key)
);

-- 2. TRIGGER: updated_at
CREATE OR REPLACE FUNCTION public.set_agent_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_settings_updated ON public.agent_settings;

CREATE TRIGGER trg_agent_settings_updated
BEFORE UPDATE ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.set_agent_settings_updated_at();

-- 3. ENABLE RLS
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES

-- SELECT: Only members of the workspace can view agent settings
DROP POLICY IF EXISTS "agent_settings_select" ON public.agent_settings;
CREATE POLICY "agent_settings_select"
ON public.agent_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.agents a
    JOIN public.workspace_members wm ON wm.workspace_id = a.workspace_id
    JOIN public.users u ON u.id = wm.user_id
    WHERE a.id = agent_settings.agent_id
      AND u.auth_uid = auth.uid()
  )
);

-- INSERT: Only members of the workspace can insert agent settings
DROP POLICY IF EXISTS "agent_settings_insert" ON public.agent_settings;
CREATE POLICY "agent_settings_insert"
ON public.agent_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.agents a
    JOIN public.workspace_members wm ON wm.workspace_id = a.workspace_id
    JOIN public.users u ON u.id = wm.user_id
    WHERE a.id = agent_settings.agent_id
      AND u.auth_uid = auth.uid()
  )
);

-- UPDATE: Only members of the workspace can update agent settings
DROP POLICY IF EXISTS "agent_settings_update" ON public.agent_settings;
CREATE POLICY "agent_settings_update"
ON public.agent_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.agents a
    JOIN public.workspace_members wm ON wm.workspace_id = a.workspace_id
    JOIN public.users u ON u.id = wm.user_id
    WHERE a.id = agent_settings.agent_id
      AND u.auth_uid = auth.uid()
  )
);