-- ============================================================================
-- Retail Assist App - Complete Supabase SQL Setup (Production Ready)
-- Migration: 002_complete_schema.sql
-- Purpose: Full production-ready schema including plans, billing, momo payments, RLS policies, and helper functions
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  business_name TEXT,
  business_description TEXT,
  country TEXT,
  time_zone TEXT DEFAULT 'UTC',
  subscription_tier TEXT DEFAULT 'free',
  api_key TEXT UNIQUE NOT NULL GENERATED ALWAYS AS ('sk_' || encode(gen_random_bytes(32), 'base64')) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

-- ============================================================================
-- 2. WORKSPACES
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  meta_page_id TEXT,
  meta_page_access_token TEXT,
  whatsapp_business_account_id TEXT,
  whatsapp_phone_number_id TEXT,
  whatsapp_api_token TEXT,
  website_domain TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_meta_page_id ON workspaces(meta_page_id);

-- ============================================================================
-- 3. WORKSPACE MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

-- ============================================================================
-- 4. AGENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  greeting TEXT,
  fallback TEXT,
  model TEXT DEFAULT 'gpt-4o-mini',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  api_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'facebook',
  platform_comment_id TEXT,
  author_id TEXT,
  author_name TEXT,
  author_email TEXT,
  content TEXT NOT NULL,
  post_id TEXT,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  bot_reply TEXT,
  bot_reply_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_agent_id ON comments(agent_id);
CREATE INDEX IF NOT EXISTS idx_comments_platform ON comments(platform);
CREATE INDEX IF NOT EXISTS idx_comments_processed ON comments(processed);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- ============================================================================
-- 6. DIRECT MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL,
  recipient_name TEXT,
  sender_display TEXT DEFAULT 'Retail Assist Bot',
  content TEXT NOT NULL,
  platform TEXT DEFAULT 'email',
  platform_message_id TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_workspace_id ON direct_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_agent_id ON direct_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_id ON direct_messages(recipient_id);

-- ============================================================================
-- 7. MESSAGE LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id TEXT,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  tokens_used INTEGER,
  cost DECIMAL(10,6),
  user_id TEXT,
  platform TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_logs_agent_id ON message_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_workspace_id ON message_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_session_id ON message_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at);

-- ============================================================================
-- 8. AUTOMATION RULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  trigger_type TEXT,
  trigger_words TEXT[],
  trigger_platforms TEXT[] DEFAULT ARRAY['facebook', 'instagram'],
  action_type TEXT,
  send_public_reply BOOLEAN DEFAULT false,
  public_reply_template TEXT,
  send_private_reply BOOLEAN DEFAULT true,
  private_reply_template TEXT,
  auto_skip_replies BOOLEAN DEFAULT true,
  skip_if_keyword_present TEXT[],
  delay_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_workspace_id ON automation_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_agent_id ON automation_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(enabled);

-- ============================================================================
-- 9. INTEGRATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  config JSONB,
  total_requests INTEGER DEFAULT 0,
  last_sync_at TIMESTAMP,
  last_error TEXT,
  last_error_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  UNIQUE(workspace_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_workspace_id ON integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);

-- ============================================================================
-- 10. PLANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2),
  price_yearly NUMERIC(10,2),
  included_monthly_usage BIGINT DEFAULT 0,
  included_features TEXT[],
  stripe_product_id TEXT,
  paypal_plan_id TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);

-- ============================================================================
-- 11. SUBSCRIPTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT DEFAULT 'trial',
  billing_cycle TEXT DEFAULT 'monthly',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  renewal_date TIMESTAMP,
  provider TEXT,
  provider_subscription_id TEXT,
  grace_period_days INT DEFAULT 7,
  is_on_grace_period BOOLEAN DEFAULT false,
  grace_period_ends_at TIMESTAMP,
  last_payment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal_date ON subscriptions(renewal_date);

-- ============================================================================
-- 12. BILLING PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  transaction_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_subscription_id ON billing_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_workspace_id ON billing_payments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON billing_payments(status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_provider ON billing_payments(provider);

-- ============================================================================
-- 13. MOBILE MONEY PAYMENTS (momo_payments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS momo_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'BWP',
  reference_code TEXT NOT NULL UNIQUE,
  provider TEXT DEFAULT 'mtn',
  status TEXT DEFAULT 'pending',
  notes TEXT,
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_momo_payments_subscription_id ON momo_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_momo_payments_workspace_id ON momo_payments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_momo_payments_status ON momo_payments(status);
CREATE INDEX IF NOT EXISTS idx_momo_payments_reference_code ON momo_payments(reference_code);
CREATE INDEX IF NOT EXISTS idx_momo_payments_created_at ON momo_payments(created_at);

-- ============================================================================
-- 14. AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- 15. FACEBOOK EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS fb_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  platform TEXT DEFAULT 'facebook',
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  response_sent BOOLEAN DEFAULT false,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fb_events_workspace_id ON fb_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_fb_events_page_id ON fb_events(page_id);
CREATE INDEX IF NOT EXISTS idx_fb_events_processed ON fb_events(processed);
CREATE INDEX IF NOT EXISTS idx_fb_events_created_at ON fb_events(created_at);
CREATE INDEX IF NOT EXISTS idx_fb_events_event_type ON fb_events(event_type);

-- ============================================================================
-- 16. HELPER FUNCTIONS
-- ============================================================================
-- Update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
  LOOP
    EXECUTE format('
      CREATE TRIGGER %I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();
    ', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- 17. RLS POLICIES (ALL TABLES)
-- ============================================================================

-- USERS
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON users FOR UPDATE
  USING (auth.uid() = id);

-- WORKSPACES
CREATE POLICY IF NOT EXISTS "Users can view their workspaces" ON workspaces FOR SELECT
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = workspaces.id AND workspace_members.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can modify workspaces they own" ON workspaces FOR UPDATE
  USING (owner_id = auth.uid());

-- AGENTS
CREATE POLICY IF NOT EXISTS "Users can manage agents in workspaces" ON agents FOR SELECT, UPDATE, DELETE
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = agents.workspace_id AND workspace_members.user_id = auth.uid() AND role IN ('owner', 'admin')));

-- COMMENTS
CREATE POLICY IF NOT EXISTS "Users can access comments in their workspace" ON comments FOR SELECT, INSERT, UPDATE
  USING (EXISTS (SELECT 1 FROM agents JOIN workspace_members ON agents.workspace_id = workspace_members.workspace_id WHERE agents.id = comments.agent_id AND workspace_members.user_id = auth.uid()));

-- DIRECT MESSAGES
CREATE POLICY IF NOT EXISTS "Users can access DMs in their workspace" ON direct_messages FOR SELECT, INSERT, UPDATE
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = direct_messages.workspace_id AND workspace_members.user_id = auth.uid()));

-- MESSAGE LOGS
CREATE POLICY IF NOT EXISTS "Users can view message logs in workspace" ON message_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = message_logs.workspace_id AND workspace_members.user_id = auth.uid()));

-- AUTOMATION RULES
CREATE POLICY IF NOT EXISTS "Users can manage rules in their workspace" ON automation_rules FOR SELECT, INSERT, UPDATE, DELETE
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = automation_rules.workspace_id AND workspace_members.user_id = auth.uid() AND role IN ('owner', 'admin')));

-- INTEGRATIONS
CREATE POLICY IF NOT EXISTS "Users can manage integrations in workspace" ON integrations FOR SELECT, INSERT, UPDATE, DELETE
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = integrations.workspace_id AND workspace_members.user_id = auth.uid() AND role IN ('owner', 'admin')));

-- SUBSCRIPTIONS
CREATE POLICY IF NOT EXISTS "Users can view subscription in workspace" ON subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = subscriptions.workspace_id AND workspace_members.user_id = auth.uid()));

-- BILLING PAYMENTS & MOMO PAYMENTS
CREATE POLICY IF NOT EXISTS "Users can view payments in workspace" ON billing_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = billing_payments.workspace_id AND workspace_members.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can view momo payments in workspace" ON momo_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = momo_payments.workspace_id AND workspace_members.user_id = auth.uid()));

-- AUDIT LOGS
CREATE POLICY IF NOT EXISTS "Users can view audit logs in workspace" ON audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = audit_logs.workspace_id AND workspace_members.user_id = auth.uid()));

-- FACEBOOK EVENTS
CREATE POLICY IF NOT EXISTS "Users can view FB events in workspace" ON fb_events FOR SELECT, INSERT, UPDATE, DELETE
  USING (EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = fb_events.workspace_id AND workspace_members.user_id = auth.uid() AND role IN ('owner', 'admin')));

-- ============================================================================
-- 18. GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- 19. ENABLE RLS
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- ============================================================================
-- ✅ END OF PRODUCTION-READY SETUP
-- ============================================================================
