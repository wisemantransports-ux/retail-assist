-- =============================================
-- 019_payment_plans.sql
-- Payment Plans table + RLS + triggers
-- =============================================

-- ============================================================================
-- 1. PAYMENT PLANS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    features JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_name ON public.payment_plans(name);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Admins can manage all plans
DROP POLICY IF EXISTS "payment_plans_admin_access" ON public.payment_plans;
CREATE POLICY "payment_plans_admin_access"
  ON public.payment_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = ANY (
        SELECT id FROM public.workspaces
      )
      AND u.auth_uid = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- ============================================================================
-- 4. TRIGGERS: updated_at auto-update
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at_payment_plans()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_plans_updated ON public.payment_plans;
CREATE TRIGGER trg_payment_plans_updated
BEFORE UPDATE ON public.payment_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_payment_plans();

-- ============================================================================
-- END OF 019
-- ============================================================================