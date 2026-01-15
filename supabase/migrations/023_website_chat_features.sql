-- =============================================
-- 023_website_chat_features.sql
-- Website chat enhancements (aligned with 002 schema)
-- =============================================

-- ============================================================================
-- 1. PLATFORM SUPPORT
-- ============================================================================

ALTER TABLE public.discussion_messages
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'website';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_discussion_messages_platform'
  ) THEN
    ALTER TABLE public.discussion_messages
    ADD CONSTRAINT chk_discussion_messages_platform
    CHECK (platform IN ('website','facebook','messenger','instagram','whatsapp'));
  END IF;
END
$$;

-- ============================================================================
-- 2. READ / UNREAD TRACKING
-- ============================================================================

ALTER TABLE public.discussion_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- ============================================================================
-- 3. UPDATED_AT FOR CHAT ORDERING
-- ============================================================================

ALTER TABLE public.discussion_messages
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_discussion_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discussion_messages_updated
  ON public.discussion_messages;

CREATE TRIGGER trg_discussion_messages_updated
BEFORE UPDATE ON public.discussion_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_discussion_messages_updated_at();

-- ============================================================================
-- 5. INDEXES FOR CHAT PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_discussion_messages_platform
  ON public.discussion_messages(platform);

CREATE INDEX IF NOT EXISTS idx_discussion_messages_is_read
  ON public.discussion_messages(is_read);

CREATE INDEX IF NOT EXISTS idx_discussion_messages_updated_at
  ON public.discussion_messages(updated_at);

-- =============================================
-- END OF 023
-- =============================================