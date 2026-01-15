-- =============================================
-- 021_notifications_patch.sql
-- Fix missing "read" column + RLS + triggers
-- =============================================

-- ============================================================================
-- 1. ADD MISSING COLUMN (SAFE)
-- ============================================================================

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id
  ON public.notifications(workspace_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read
  ON public.notifications(read);

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- Workspace members can SELECT notifications
DROP POLICY IF EXISTS notifications_workspace_member_select
  ON public.notifications;

CREATE POLICY notifications_workspace_member_select
ON public.notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = notifications.workspace_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

-- Workspace members can UPDATE notifications
DROP POLICY IF EXISTS notifications_workspace_member_update
  ON public.notifications;

CREATE POLICY notifications_workspace_member_update
ON public.notifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = notifications.workspace_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

-- Only the owner can mark notification as read
DROP POLICY IF EXISTS notifications_user_read_update
  ON public.notifications;

CREATE POLICY notifications_user_read_update
ON public.notifications
FOR UPDATE
USING (
  user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
)
WITH CHECK (
  user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
);

-- ============================================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at_notifications()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_updated
  ON public.notifications;

CREATE TRIGGER trg_notifications_updated
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_notifications();

-- ============================================================================
-- END OF 021 PATCH
-- ============================================================================