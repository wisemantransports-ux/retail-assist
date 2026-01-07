-- =============================================
-- 014_workspace_features_rls_fixed.sql
-- Workspace features and limits with correct RLS
-- =============================================

-- 1. WORKSPACE FEATURES TABLE
CREATE TABLE IF NOT EXISTS public.workspace_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, feature_key)
);

-- 2. WORKSPACE LIMITS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  max_value INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id, limit_key)
);

-- 3. TRIGGERS: updated_at
CREATE OR REPLACE FUNCTION public.set_workspace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_features_updated ON public.workspace_features;
CREATE TRIGGER trg_workspace_features_updated
BEFORE UPDATE ON public.workspace_features
FOR EACH ROW EXECUTE FUNCTION public.set_workspace_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_limits_updated ON public.workspace_limits;
CREATE TRIGGER trg_workspace_limits_updated
BEFORE UPDATE ON public.workspace_limits
FOR EACH ROW EXECUTE FUNCTION public.set_workspace_updated_at();

-- 4. ENABLE RLS
ALTER TABLE public.workspace_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_limits ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES: workspace access
-- FEATURES
DROP POLICY IF EXISTS "workspace_features_select" ON public.workspace_features;
CREATE POLICY "workspace_features_select"
ON public.workspace_features FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = workspace_features.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

DROP POLICY IF EXISTS "workspace_features_update" ON public.workspace_features;
CREATE POLICY "workspace_features_update"
ON public.workspace_features FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = workspace_features.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

DROP POLICY IF EXISTS "workspace_features_insert" ON public.workspace_features;
CREATE POLICY "workspace_features_insert"
ON public.workspace_features FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = workspace_features.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

-- LIMITS
DROP POLICY IF EXISTS "workspace_limits_select" ON public.workspace_limits;
CREATE POLICY "workspace_limits_select"
ON public.workspace_limits FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = workspace_limits.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

DROP POLICY IF EXISTS "workspace_limits_update" ON public.workspace_limits;
CREATE POLICY "workspace_limits_update"
ON public.workspace_limits FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = workspace_limits.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

DROP POLICY IF EXISTS "workspace_limits_insert" ON public.workspace_limits;
CREATE POLICY "workspace_limits_insert"
ON public.workspace_limits FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = workspace_limits.workspace_id
      AND u.auth_uid = auth.uid()
  )
);