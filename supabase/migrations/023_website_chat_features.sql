-- =============================================
-- 023_website_chat_features.sql
-- Enhance website chat handling for agents and workspaces
-- =============================================

-- 1. Ensure platform column has expected values
ALTER TABLE IF EXISTS public.comments
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'website';

-- Optional: Enforce platform consistency with a CHECK constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_comments_platform'
    ) THEN
        ALTER TABLE public.comments
        ADD CONSTRAINT chk_comments_platform
        CHECK (platform IN ('website','facebook','messenger','instagram','whatsapp'));
    END IF;
END
$$;

-- 2. Add read/unread tracking
ALTER TABLE IF EXISTS public.comments
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 3. Add timestamp for last update (for chat ordering)
ALTER TABLE IF EXISTS public.comments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4. Trigger to auto-update updated_at on comment changes
CREATE OR REPLACE FUNCTION public.set_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comments_updated ON public.comments;
CREATE TRIGGER trg_comments_updated
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.set_comments_updated_at();

-- 5. Indexes for faster query on website chat
CREATE INDEX IF NOT EXISTS idx_comments_platform ON public.comments(platform);
CREATE INDEX IF NOT EXISTS idx_comments_is_read ON public.comments(is_read);
CREATE INDEX IF NOT EXISTS idx_comments_updated_at ON public.comments(updated_at);

-- 6. Ensure message_logs references are intact
ALTER TABLE IF EXISTS public.message_logs
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'website';

-- Optional: enforce platform consistency in message_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_message_logs_platform'
    ) THEN
        ALTER TABLE public.message_logs
        ADD CONSTRAINT chk_message_logs_platform
        CHECK (platform IN ('website','facebook','messenger','instagram','whatsapp'));
    END IF;
END
$$;

-- Indexes for message_logs performance
CREATE INDEX IF NOT EXISTS idx_message_logs_platform ON public.message_logs(platform);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON public.message_logs(created_at);

-- =============================================
-- END OF 023
-- =============================================