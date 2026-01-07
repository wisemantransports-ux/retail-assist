-- =============================================
-- 018_whatsapp_events.sql
-- WHATSAPP MESSAGE EVENTS LOGGING
-- Builds on 002 core schema + 017_whatsapp_numbers
-- =============================================

-- ============================================================================
-- 1. WHATSAPP EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  whatsapp_number_id UUID NOT NULL REFERENCES public.whatsapp_numbers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,       -- e.g., 'message_in', 'message_out', 'status'
  contact_phone TEXT NOT NULL,
  message_text TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_workspace_id ON public.whatsapp_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_number_id ON public.whatsapp_events(whatsapp_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_events_processed ON public.whatsapp_events(processed);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Users can view events only in their workspace
DROP POLICY IF EXISTS "users_can_view_whatsapp_events" ON public.whatsapp_events;
CREATE POLICY "users_can_view_whatsapp_events"
  ON public.whatsapp_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = whatsapp_events.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- Users can update events only in their workspace (if needed)
DROP POLICY IF EXISTS "users_can_update_whatsapp_events" ON public.whatsapp_events;
CREATE POLICY "users_can_update_whatsapp_events"
  ON public.whatsapp_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = whatsapp_events.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_whatsapp_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_events_updated ON public.whatsapp_events;
CREATE TRIGGER trg_whatsapp_events_updated
BEFORE UPDATE ON public.whatsapp_events
FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_events_updated_at();

-- ============================================================================
-- END OF 018
-- ============================================================================