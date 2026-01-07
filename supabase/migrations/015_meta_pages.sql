-- =============================================
-- 015_meta_pages.sql
-- FACEBOOK / META PAGES INTEGRATION
-- Builds on 002 core schema
-- =============================================

-- ============================================================================
-- 1. META PAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meta_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL UNIQUE,  -- FB Page ID
  name TEXT,
  access_token TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meta_pages_workspace_id ON public.meta_pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meta_pages_active ON public.meta_pages(active);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Users can view pages only in their workspaces
DROP POLICY IF EXISTS "users_can_view_meta_pages" ON public.meta_pages;
CREATE POLICY "users_can_view_meta_pages"
  ON public.meta_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = meta_pages.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- Users can update pages only in their workspaces
DROP POLICY IF EXISTS "users_can_update_meta_pages" ON public.meta_pages;
CREATE POLICY "users_can_update_meta_pages"
  ON public.meta_pages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = meta_pages.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Automatically update updated_at
CREATE OR REPLACE FUNCTION public.set_meta_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meta_pages_updated ON public.meta_pages;
CREATE TRIGGER trg_meta_pages_updated
BEFORE UPDATE ON public.meta_pages
FOR EACH ROW EXECUTE FUNCTION public.set_meta_pages_updated_at();

-- ============================================================================
-- END OF 015
-- ============================================================================