-- =============================================
-- 010_workspace_limits.sql
-- Migration to enforce workspace usage and agent limits
-- Builds on 002 + 009
-- =============================================

-- ============================================================================
-- 1. Workspace Limits Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  monthly_tokens_limit INTEGER DEFAULT 10000,
  max_agents INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_limits_workspace_id
  ON public.workspace_limits(workspace_id);

-- ============================================================================
-- 2. Trigger to update updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS trg_workspace_limits_updated ON public.workspace_limits;
CREATE TRIGGER trg_workspace_limits_updated
BEFORE UPDATE ON public.workspace_limits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. Enable RLS
-- ============================================================================

ALTER TABLE public.workspace_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS Policies (one per operation)
-- ============================================================================

-- SELECT
DROP POLICY IF EXISTS "workspace_owner_select" ON public.workspace_limits;
CREATE POLICY "workspace_owner_select"
  ON public.workspace_limits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      JOIN public.users u ON u.id = w.owner_id
      WHERE w.id = workspace_limits.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "workspace_owner_update" ON public.workspace_limits;
CREATE POLICY "workspace_owner_update"
  ON public.workspace_limits
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      JOIN public.users u ON u.id = w.owner_id
      WHERE w.id = workspace_limits.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- 5. Seed default limits for existing workspaces
-- ============================================================================

INSERT INTO public.workspace_limits (workspace_id)
SELECT id FROM public.workspaces
WHERE id NOT IN (SELECT workspace_id FROM public.workspace_limits);

-- ============================================================================
-- END OF 010
-- ============================================================================