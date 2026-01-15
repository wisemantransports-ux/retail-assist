-- =============================================
-- 022_discussions_and_messages.sql
-- Aligned with 002 schema (FINAL)
-- =============================================

-- ============================================================================
-- 1. DISCUSSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. DISCUSSION MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.discussion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.disussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- DISCUSSIONS
DROP POLICY IF EXISTS discussions_select ON public.discussions;
CREATE POLICY discussions_select
ON public.discussions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = discussions.workspace_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS discussions_insert ON public.discussions;
CREATE POLICY discussions_insert
ON public.discussions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = discussions.workspace_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS discussions_update ON public.discussions;
CREATE POLICY discussions_update
ON public.discussions FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = discussions.workspace_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS discussions_delete ON public.discussions;
CREATE POLICY discussions_delete
ON public.discussions FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = discussions.workspace_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

-- DISCUSSION MESSAGES
DROP POLICY IF EXISTS discussion_messages_select ON public.discussion_messages;
CREATE POLICY discussion_messages_select
ON public.discussion_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.discussions d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id
    WHERE d.id = discussion_messages.discussion_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS discussion_messages_insert ON public.discussion_messages;
CREATE POLICY discussion_messages_insert
ON public.discussion_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.discussions d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id
    WHERE d.id = discussion_messages.discussion_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS discussion_messages_update ON public.discussion_messages;
CREATE POLICY discussion_messages_update
ON public.discussion_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.discussions d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id
    WHERE d.id = discussion_messages.discussion_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS discussion_messages_delete ON public.discussion_messages;
CREATE POLICY discussion_messages_delete
ON public.discussion_messages FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.discussions d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id
    WHERE d.id = discussion_messages.discussion_id
      AND wm.user_id = (
        SELECT id FROM public.users WHERE auth_uid = auth.uid()
      )
  )
);

-- ============================================================================
-- 5. UPDATED_AT TRIGGER (DISCUSSIONS ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at_discussions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discussions_updated
ON public.discussions;

CREATE TRIGGER trg_discussions_updated
BEFORE UPDATE ON public.discussions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_discussions();

-- ============================================================================
-- END OF 022
-- ============================================================================