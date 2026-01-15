-- =========================================================
-- 008_ai_usage_policies.sql
-- AI Usage Tracking, Billing Safety & Hard Limits
-- =========================================================
-- Purpose:
-- 1. Track AI token usage per workspace per billing period
-- 2. Enforce hard monthly token limits by plan
-- 3. Prevent unexpected AI billing overages
-- 4. Provide admin visibility into workspace usage
--
-- Notes:
-- - agent_id is a SOFT reference (no FK by design)
-- - Enforcement happens at the database layer
-- =========================================================


-- =========================================================
-- Monthly AI usage aggregation (per workspace)
-- =========================================================
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL
    REFERENCES workspaces(id) ON DELETE CASCADE,

  period_start date NOT NULL, -- YYYY-MM-01
  period_end date NOT NULL,   -- YYYY-MM-28/30/31

  tokens_used integer NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,

  model_usage jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, period_start)
);


-- =========================================================
-- Detailed AI usage logs (immutable audit trail)
-- =========================================================
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id uuid NOT NULL
    REFERENCES workspaces(id) ON DELETE CASCADE,

  agent_id uuid, -- Soft reference to agents.id (no FK by design)

  session_id text,
  user_message text,
  assistant_message text,

  tokens_used integer NOT NULL,
  cost_cents integer NOT NULL,

  model text NOT NULL,
  platform text, -- facebook | instagram | website | whatsapp

  created_at timestamptz NOT NULL DEFAULT now()
);


-- =========================================================
-- Function: Check AI usage vs plan limits
-- =========================================================
CREATE OR REPLACE FUNCTION check_ai_usage(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace workspaces;
  v_used_tokens integer := 0;
  v_monthly_limit integer;
  v_percent_used numeric;
BEGIN
  SELECT * INTO v_workspace
  FROM workspaces
  WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'workspace_not_found',
      'hard_blocked', true
    );
  END IF;

  -- Plan-based defaults
  CASE v_workspace.plan_type
    WHEN 'starter' THEN v_monthly_limit := 50000;
    WHEN 'pro' THEN v_monthly_limit := 150000;
    WHEN 'advanced' THEN v_monthly_limit := 300000;
    WHEN 'enterprise' THEN v_monthly_limit := -1; -- Unlimited
    ELSE v_monthly_limit := 5000; -- Free / preview
  END CASE;

  -- Get current month usage
  SELECT COALESCE(tokens_used, 0)
  INTO v_used_tokens
  FROM ai_usage
  WHERE workspace_id = p_workspace_id
    AND period_start = date_trunc('month', CURRENT_DATE)::date;

  IF v_monthly_limit = -1 THEN
    RETURN jsonb_build_object(
      'monthly_limit', -1,
      'tokens_used', v_used_tokens,
      'percent_used', 0,
      'hard_blocked', false
    );
  END IF;

  v_percent_used :=
    (v_used_tokens::numeric / v_monthly_limit::numeric) * 100;

  RETURN jsonb_build_object(
    'monthly_limit', v_monthly_limit,
    'tokens_used', v_used_tokens,
    'percent_used', v_percent_used,
    'hard_blocked', v_percent_used >= 100
  );
END;
$$;


-- =========================================================
-- Function: Record AI usage (atomic & safe)
-- =========================================================
CREATE OR REPLACE FUNCTION record_ai_usage(
  p_workspace_id uuid,
  p_tokens_used integer,
  p_cost_cents integer,
  p_model text DEFAULT 'gpt-4o-mini',
  p_agent_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_user_message text DEFAULT NULL,
  p_assistant_message text DEFAULT NULL,
  p_platform text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start date;
  v_period_end date;
BEGIN
  v_period_start := date_trunc('month', CURRENT_DATE)::date;
  v_period_end :=
    (v_period_start + interval '1 month' - interval '1 day')::date;

  INSERT INTO ai_usage (
    workspace_id,
    period_start,
    period_end,
    tokens_used,
    cost_cents,
    model_usage
  )
  VALUES (
    p_workspace_id,
    v_period_start,
    v_period_end,
    p_tokens_used,
    p_cost_cents,
    jsonb_build_object(p_model, p_tokens_used)
  )
  ON CONFLICT (workspace_id, period_start)
  DO UPDATE SET
    tokens_used = ai_usage.tokens_used + p_tokens_used,
    cost_cents = ai_usage.cost_cents + p_cost_cents,
    model_usage = jsonb_set(
      ai_usage.model_usage,
      ARRAY[p_model],
      to_jsonb(
        COALESCE((ai_usage.model_usage ->> p_model)::int, 0)
        + p_tokens_used
      ),
      true
    ),
    updated_at = now();

  INSERT INTO ai_usage_logs (
    workspace_id,
    agent_id,
    session_id,
    user_message,
    assistant_message,
    tokens_used,
    cost_cents,
    model,
    platform
  )
  VALUES (
    p_workspace_id,
    p_agent_id,
    p_session_id,
    p_user_message,
    p_assistant_message,
    p_tokens_used,
    p_cost_cents,
    p_model,
    p_platform
  );
END;
$$;


-- =========================================================
-- Row Level Security
-- =========================================================
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_access ON ai_usage
FOR ALL USING (
  workspace_id IN (
    SELECT wm.workspace_id
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE u.auth_uid = auth.uid()::uuid
  )
);

CREATE POLICY ai_usage_logs_access ON ai_usage_logs
FOR ALL USING (
  workspace_id IN (
    SELECT wm.workspace_id
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE u.auth_uid = auth.uid()::uuid
  )
);


-- =========================================================
-- Reflective indexes
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_period
  ON ai_usage(workspace_id, period_start);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_workspace_created
  ON ai_usage_logs(workspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_agent
  ON ai_usage_logs(agent_id);