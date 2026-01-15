--- =============================================
-- 012_workspace_limits_usage_rls_fixed.sql
-- Aligned with 002 schema
-- =============================================

-- 1. WORKSPACE LIMITS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  monthly_message_limit INTEGER DEFAULT 10000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id)
);

-- 2. AI USAGE LOGS TABLE
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TRIGGERS: workspace_limits updated_at
CREATE OR REPLACE FUNCTION public.set_workspace_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_limits_updated
  ON public.workspace_limits;

CREATE TRIGGER trg_workspace_limits_updated
BEFORE UPDATE ON public.workspace_limits
FOR EACH ROW EXECUTE FUNCTION public.set_workspace_limits_updated_at();

-- 4. ENABLE RLS
ALTER TABLE public.workspace_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 5. WORKSPACE LIMITS POLICIES

-- SELECT policy
DROP POLICY IF EXISTS "workspace_limits_select" ON public.workspace_limits;
CREATE POLICY "workspace_limits_select"
ON public.workspace_limits
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_limits.workspace_id
      AND wm.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  )
);

-- UPDATE policy
DROP POLICY IF EXISTS "workspace_limits_update" ON public.workspace_limits;
CREATE POLICY "workspace_limits_update"
ON public.workspace_limits
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_limits.workspace_id
      AND wm.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  )
);

-- 6. AI USAGE LOGS POLICIES

-- SELECT policy
DROP POLICY IF EXISTS "ai_usage_logs_select" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_select"
ON public.ai_usage_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = ai_usage_logs.workspace_id
      AND wm.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  )
);

-- INSERT policy
DROP POLICY IF EXISTS "ai_usage_logs_insert" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_insert"
ON public.ai_usage_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = ai_usage_logs.workspace_id
      AND wm.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  )
);