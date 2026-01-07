-- =============================================
-- 016_meta_events.sql
-- FACEBOOK / META EVENTS LOGGING
-- Builds on 002 core schema + 015_meta_pages
-- =============================================

-- ============================================================================
-- 1. FB / META EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meta_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_page_id UUID NOT NULL REFERENCES public.meta_pages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,       -- e.g., 'comment', 'message', 'reaction'
  sender_name TEXT,
  sender_id TEXT,
  content TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meta_events_meta_page_id ON public.meta_events(meta_page_id);
CREATE INDEX IF NOT EXISTS idx_meta_events_workspace_id ON public.meta_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meta_events_processed ON public.meta_events(processed);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.meta_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Users can view events only in their workspaces
DROP POLICY IF EXISTS "users_can_view_meta_events" ON public.meta_events;
CREATE POLICY "users_can_view_meta_events"
  ON public.meta_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      JOIN public.meta_pages mp ON mp.id = meta_events.meta_page_id
      WHERE wm.workspace_id = meta_events.workspace_id
        AND mp.workspace_id = wm.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- Users can update events only in their workspace (e.g., mark processed)
DROP POLICY IF EXISTS "users_can_update_meta_events" ON public.meta_events;
CREATE POLICY "users_can_update_meta_events"
  ON public.meta_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      JOIN public.meta_pages mp ON mp.id = meta_events.meta_page_id
      WHERE wm.workspace_id = meta_events.workspace_id
        AND mp.workspace_id = wm.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Automatically update updated_at (if we add updated_at in future)
CREATE OR REPLACE FUNCTION public.set_meta_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Placeholder: add updated_at column in future if needed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF 016
-- ============================================================================