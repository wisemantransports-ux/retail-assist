-- =============================================
-- 021_notifications.sql
-- Notifications / Alerts table + RLS + triggers
-- =============================================

-- ============================================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,          -- e.g., 'system', 'agent_alert', 'payment'
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON public.notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Workspace members can SELECT notifications
DROP POLICY IF EXISTS "notifications_workspace_member_select" ON public.notifications;
CREATE POLICY "notifications_workspace_member_select"
  ON public.notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = notifications.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- Workspace members can UPDATE notifications
DROP POLICY IF EXISTS "notifications_workspace_member_update" ON public.notifications;
CREATE POLICY "notifications_workspace_member_update"
  ON public.notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = notifications.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- User-specific notifications: only the intended user can mark 'read'
DROP POLICY IF EXISTS "notifications_user_read_update" ON public.notifications;
CREATE POLICY "notifications_user_read_update"
  ON public.notifications FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid()));

-- ============================================================================
-- 4. TRIGGERS: updated_at auto-update
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at_notifications()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_updated ON public.notifications;
CREATE TRIGGER trg_notifications_updated
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_notifications();

-- ============================================================================
-- END OF 021
-- ============================================================================