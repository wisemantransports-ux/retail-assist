-- =============================================
-- 020_payment_usage.sql
-- Payment Usage / Logs table + RLS + triggers
-- =============================================

-- ============================================================================
-- 1. PAYMENT USAGE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount_paid NUMERIC(10,2) DEFAULT 0.00,
    used_units INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_usage_workspace_id ON public.payment_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payment_usage_plan_id ON public.payment_usage(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_usage_period ON public.payment_usage(period_start, period_end);

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.payment_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Admins of workspace can manage their payment usage
DROP POLICY IF EXISTS "payment_usage_workspace_admin_access" ON public.payment_usage;
CREATE POLICY "payment_usage_workspace_admin_access"
  ON public.payment_usage FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.users u ON u.id = wm.user_id
      WHERE wm.workspace_id = payment_usage.workspace_id
        AND u.auth_uid = auth.uid()
        AND wm.role = 'admin'
    )
  );

-- ============================================================================
-- 4. TRIGGERS: updated_at auto-update
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at_payment_usage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_usage_updated ON public.payment_usage;
CREATE TRIGGER trg_payment_usage_updated
BEFORE UPDATE ON public.payment_usage
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_payment_usage();

-- ============================================================================
-- END OF 020
-- ============================================================================