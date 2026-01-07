-- =============================================
-- 017_whatsapp_numbers.sql
-- WHATSAPP NUMBERS LOGGING
-- Builds on 002 core schema + workspace linkage
-- =============================================

-- ============================================================================
-- 1. WHATSAPP NUMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  label TEXT,
  status TEXT DEFAULT 'active',  -- e.g., 'active', 'inactive'
  api_key TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_numbers_workspace_id ON public.whatsapp_numbers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_numbers_status ON public.whatsapp_numbers(status);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.whatsapp_numbers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Users can view numbers only in their workspace
DROP POLICY IF EXISTS "users_can_view_whatsapp_numbers" ON public.whatsapp_numbers;
CREATE POLICY "users_can_view_whatsapp_numbers"
  ON public.whatsapp_numbers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = whatsapp_numbers.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- Users can update numbers only in their workspace
DROP POLICY IF EXISTS "users_can_update_whatsapp_numbers" ON public.whatsapp_numbers;
CREATE POLICY "users_can_update_whatsapp_numbers"
  ON public.whatsapp_numbers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = whatsapp_numbers.workspace_id
        AND u.auth_uid = auth.uid()
    )
  );

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_whatsapp_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_numbers_updated ON public.whatsapp_numbers;
CREATE TRIGGER trg_whatsapp_numbers_updated
BEFORE UPDATE ON public.whatsapp_numbers
FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_numbers_updated_at();

-- ============================================================================
-- END OF 017
-- ============================================================================