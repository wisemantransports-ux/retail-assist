-- =============================================
-- 027_agents_table.sql
-- Create agents table with RLS for workspace enforcement
-- Builds on 002 schema (users + workspaces)
-- =============================================

-- 1. Create agents table
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    ai_enabled BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active', -- active, inactive, archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON public.agents(workspace_id);

-- 3. Trigger to update updated_at on modification
CREATE OR REPLACE FUNCTION public.set_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agents_updated ON public.agents;
CREATE TRIGGER trg_agents_updated
BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.set_agents_updated_at();

-- 4. Enable Row-Level Security
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- SELECT: Only members of the workspace can see agents
DROP POLICY IF EXISTS "agents_workspace_access" ON public.agents;
CREATE POLICY "agents_workspace_access"
ON public.agents
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = agents.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

-- INSERT: Only workspace owner can create agents
DROP POLICY IF EXISTS "agents_insert_limit" ON public.agents;
CREATE POLICY "agents_insert_limit"
ON public.agents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.users u ON u.id = w.owner_id
    WHERE w.id = agents.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

-- UPDATE: Only workspace members can update agents
DROP POLICY IF EXISTS "agents_update_access" ON public.agents;
CREATE POLICY "agents_update_access"
ON public.agents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = agents.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

-- DELETE: Only workspace owner can delete
DROP POLICY IF EXISTS "agents_delete_access" ON public.agents;
CREATE POLICY "agents_delete_access"
ON public.agents
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspaces w
    JOIN public.users u ON u.id = w.owner_id
    WHERE w.id = agents.workspace_id
      AND u.auth_uid = auth.uid()
  )
);

-- =============================================
-- End of 027_agents_table.sql
-- =============================================