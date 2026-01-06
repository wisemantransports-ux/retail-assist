-- AI Usage Tracking and Billing Integration
-- Phase 2B: OpenAI Token Accounting

-- AI Usage tracking table
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL, -- First day of billing period (YYYY-MM-01)
  period_end date NOT NULL,   -- Last day of billing period (YYYY-MM-31/30/28)
  tokens_used integer DEFAULT 0,
  cost_cents integer DEFAULT 0, -- Cost in cents (for easy integer math)
  model_usage jsonb DEFAULT '{}'::jsonb, -- Track usage by model
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(workspace_id, period_start) -- One record per workspace per month
);

-- AI Usage logs (detailed tracking)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  session_id text, -- For conversation threading
  user_message text,
  assistant_message text,
  tokens_used integer NOT NULL,
  cost_cents integer NOT NULL,
  model text NOT NULL,
  platform text, -- facebook, instagram, website, whatsapp
  created_at timestamptz DEFAULT now()
);

-- Function to check AI usage against plan limits
CREATE OR REPLACE FUNCTION check_ai_usage(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace workspaces;
  v_current_usage ai_usage;
  v_plan_limits jsonb;
  v_monthly_limit integer;
  v_used_tokens integer;
  v_percent_used numeric;
  v_hard_blocked boolean := false;
BEGIN
  -- Get workspace and plan info
  SELECT * INTO v_workspace
  FROM workspaces
  WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Workspace not found',
      'percent_used', 0,
      'hard_blocked', true
    );
  END IF;

  -- Get plan limits (default to free tier if not set)
  v_plan_limits := COALESCE(v_workspace.plan_limits, '{}'::jsonb);

  -- Default limits based on plan type
  CASE v_workspace.plan_type
    WHEN 'starter' THEN
      v_monthly_limit := 100000; -- 100K tokens
    WHEN 'pro' THEN
      v_monthly_limit := 500000; -- 500K tokens
    WHEN 'enterprise' THEN
      v_monthly_limit := -1; -- Unlimited
    ELSE
      v_monthly_limit := 10000; -- Free tier: 10K tokens
  END CASE;

  -- Override with explicit limit if set
  IF v_plan_limits ? 'monthly_tokens' THEN
    v_monthly_limit := (v_plan_limits->>'monthly_tokens')::integer;
  END IF;

  -- If unlimited, return OK
  IF v_monthly_limit = -1 THEN
    RETURN jsonb_build_object(
      'percent_used', 0,
      'hard_blocked', false,
      'monthly_limit', -1
    );
  END IF;

  -- Get current month usage
  SELECT COALESCE(tokens_used, 0) INTO v_used_tokens
  FROM ai_usage
  WHERE workspace_id = p_workspace_id
    AND period_start = date_trunc('month', CURRENT_DATE)::date;

  -- Calculate percentage used
  v_percent_used := (v_used_tokens::numeric / v_monthly_limit::numeric) * 100;

  -- Hard block at 100%
  IF v_percent_used >= 100 THEN
    v_hard_blocked := true;
  END IF;

  RETURN jsonb_build_object(
    'percent_used', v_percent_used,
    'hard_blocked', v_hard_blocked,
    'monthly_limit', v_monthly_limit,
    'tokens_used', v_used_tokens
  );
END;
$$;

-- Function to record AI usage
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
  v_model_usage jsonb;
BEGIN
  -- Calculate current billing period
  v_period_start := date_trunc('month', CURRENT_DATE)::date;
  v_period_end := (v_period_start + interval '1 month' - interval '1 day')::date;

  -- Insert or update monthly usage
  INSERT INTO ai_usage (
    workspace_id,
    period_start,
    period_end,
    tokens_used,
    cost_cents,
    model_usage
  ) VALUES (
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
      COALESCE(ai_usage.model_usage, '{}'::jsonb),
      array[p_model],
      to_jsonb(COALESCE(ai_usage.model_usage->>p_model, '0')::integer + p_tokens_used)
    ),
    updated_at = now();

  -- Insert detailed log
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
  ) VALUES (
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

-- Enable RLS on new tables
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_usage
CREATE POLICY ai_usage_workspace_access ON ai_usage FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE u.auth_uid = auth.uid()::uuid
  ) OR
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id IN (
      SELECT id FROM users WHERE auth_uid = auth.uid()::uuid
    )
  )
);

-- RLS Policies for ai_usage_logs
CREATE POLICY ai_usage_logs_workspace_access ON ai_usage_logs FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE u.auth_uid = auth.uid()::uuid
  ) OR
  workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id IN (
      SELECT id FROM users WHERE auth_uid = auth.uid()::uuid
    )
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_period ON ai_usage(workspace_id, period_start);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_workspace_created ON ai_usage_logs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_agent ON ai_usage_logs(agent_id);