-- Retail Assist App - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Purpose: Create all core tables with relationships and RLS policies

-- ============================================================================
-- 1. USERS TABLE (linked to Supabase auth.users)
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
  subscription_tier TEXT DEFAULT 'free', -- free, starter, pro, enterprise
  api_key TEXT UNIQUE NOT NULL GENERATED ALWAYS AS ('sk_' || encode(gen_random_bytes(32), 'base64')) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key ON users(api_key);

-- ============================================================================
-- 2. WORKSPACES (Multi-user/team collaboration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  meta_page_id TEXT, -- Facebook Page ID
  meta_page_access_token TEXT, -- Encrypted in production
  whatsapp_business_account_id TEXT,
  whatsapp_phone_number_id TEXT,
  whatsapp_api_token TEXT, -- Encrypted
  website_domain TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_workspaces_meta_page_id ON workspaces(meta_page_id);

-- ============================================================================
-- 3. WORKSPACE MEMBERS (Team management with roles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- owner, admin, member, viewer
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- ============================================================================
-- 4. AGENTS (AI agent configurations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  greeting TEXT,
  fallback TEXT,
  model TEXT DEFAULT 'gpt-4o-mini', -- gpt-4o, gpt-4o-mini, gpt-3.5-turbo
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  api_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_agents_workspace_id ON agents(workspace_id);
CREATE INDEX idx_agents_api_key ON agents(api_key);
CREATE INDEX idx_agents_enabled ON agents(enabled);

-- ============================================================================
-- 5. COMMENTS (Public comments from external platforms)
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'facebook', -- facebook, instagram, website, whatsapp
  platform_comment_id TEXT, -- External ID from platform
  author_id TEXT, -- External user ID from platform
  author_name TEXT,
  author_email TEXT,
  content TEXT NOT NULL,
  post_id TEXT, -- Post/Message ID on platform
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  bot_reply TEXT,
  bot_reply_id TEXT, -- ID of bot's reply on platform
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_agent_id ON comments(agent_id);
CREATE INDEX idx_comments_platform ON comments(platform);
CREATE INDEX idx_comments_processed ON comments(processed);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- ============================================================================
-- 6. DIRECT MESSAGES (DMs sent to users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL, -- Email or external user ID
  recipient_name TEXT,
  sender_display TEXT DEFAULT 'Retail Assist Bot',
  content TEXT NOT NULL,
  platform TEXT DEFAULT 'email', -- email, facebook_messenger, whatsapp, instagram_dm
  platform_message_id TEXT, -- External ID if sent via API
  status TEXT DEFAULT 'sent', -- sent, failed, read, replied
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_direct_messages_workspace_id ON direct_messages(workspace_id);
CREATE INDEX idx_direct_messages_agent_id ON direct_messages(agent_id);
CREATE INDEX idx_direct_messages_recipient_id ON direct_messages(recipient_id);

-- ============================================================================
-- 7. MESSAGE LOGS (All agent conversations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id TEXT, -- Group related messages
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  tokens_used INTEGER,
  cost DECIMAL(10,6), -- $ cost of this message pair
  user_id TEXT, -- External user identifier
  platform TEXT, -- facebook, whatsapp, website, direct_api
  metadata JSONB, -- Additional context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_message_logs_agent_id ON message_logs(agent_id);
CREATE INDEX idx_message_logs_workspace_id ON message_logs(workspace_id);
CREATE INDEX idx_message_logs_session_id ON message_logs(session_id);
CREATE INDEX idx_message_logs_created_at ON message_logs(created_at);

-- ============================================================================
-- 8. AUTOMATION RULES (Comment-to-DM, keyword replies, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- comment_to_dm, keyword_reply, scheduled_message
  enabled BOOLEAN DEFAULT true,
  
  -- Trigger configuration
  trigger_type TEXT, -- comment, keyword, time, manual
  trigger_words TEXT[], -- Array of keywords
  trigger_platforms TEXT[] DEFAULT ARRAY['facebook', 'instagram'], -- Platforms to watch
  
  -- Action configuration
  action_type TEXT, -- send_dm, send_public_reply, send_email
  send_public_reply BOOLEAN DEFAULT false,
  public_reply_template TEXT,
  send_private_reply BOOLEAN DEFAULT true,
  private_reply_template TEXT,
  
  -- Advanced options
  auto_skip_replies BOOLEAN DEFAULT true, -- Don't reply to existing replies
  skip_if_keyword_present TEXT[], -- Skip if certain words in comment
  delay_seconds INTEGER DEFAULT 0, -- Delay before sending
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_automation_rules_workspace_id ON automation_rules(workspace_id);
CREATE INDEX idx_automation_rules_agent_id ON automation_rules(agent_id);
CREATE INDEX idx_automation_rules_enabled ON automation_rules(enabled);

-- ============================================================================
-- 9. INTEGRATIONS (Connected services)
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- facebook, whatsapp, website_widget, slack, zapier
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  
  -- OAuth/API credentials (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  
  -- Configuration
  config JSONB, -- Provider-specific settings
  
  -- Stats
  total_requests INTEGER DEFAULT 0,
  last_sync_at TIMESTAMP,
  last_error TEXT,
  last_error_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  UNIQUE(workspace_id, provider)
);

CREATE INDEX idx_integrations_workspace_id ON integrations(workspace_id);
CREATE INDEX idx_integrations_provider ON integrations(provider);

-- ============================================================================
-- 10. BILLING & SUBSCRIPTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_id TEXT NOT NULL, -- starter, pro, enterprise
  plan_name TEXT NOT NULL,
  price_per_month DECIMAL(10,2),
  billing_cycle_start TIMESTAMP,
  billing_cycle_end TIMESTAMP,
  status TEXT DEFAULT 'active', -- active, past_due, canceled, paused
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- ============================================================================
-- 11. INVOICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE,
  amount_cents INTEGER, -- Amount in cents
  amount_formatted TEXT,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft', -- draft, sent, paid, void, uncollectible
  invoice_date TIMESTAMP,
  due_date TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_workspace_id ON invoices(workspace_id);

-- ============================================================================
-- 12. ANALYTICS & USAGE STATS
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  
  -- Message stats
  total_messages INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  total_dms INTEGER DEFAULT 0,
  processed_comments INTEGER DEFAULT 0,
  
  -- Engagement stats
  user_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  -- Performance stats
  avg_response_time_ms DECIMAL(10,2),
  total_tokens_used INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6), -- $ cost for the day
  
  -- Conversion stats
  total_conversations INTEGER DEFAULT 0,
  completed_conversations INTEGER DEFAULT 0,
  conversation_completion_rate DECIMAL(5,2), -- percentage
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, agent_id, stat_date)
);

CREATE INDEX idx_daily_stats_workspace_id ON daily_stats(workspace_id);
CREATE INDEX idx_daily_stats_agent_id ON daily_stats(agent_id);
CREATE INDEX idx_daily_stats_stat_date ON daily_stats(stat_date);

-- ============================================================================
-- 13. AUDIT LOGS (Activity tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- created, updated, deleted, sent, received
  resource_type TEXT NOT NULL, -- agent, rule, integration, comment
  resource_id TEXT,
  changes JSONB, -- What changed
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users: Can only read/update their own row
CREATE POLICY "Users can view own profile" ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users FOR UPDATE
  USING (auth.uid() = id);

-- Workspaces: Can access workspaces you're a member of
CREATE POLICY "Users can view workspaces they belong to" ON workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
    )
    OR owner_id = auth.uid()
  );

CREATE POLICY "Users can update workspaces they own or admin" ON workspaces FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- Workspace Members: Manage members in your workspaces
CREATE POLICY "Users can view workspace members" ON workspace_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
        AND (workspaces.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM workspace_members wm2
            WHERE wm2.workspace_id = workspaces.id
              AND wm2.user_id = auth.uid()
          ))
    )
  );

-- Agents: Can access agents in workspaces you belong to
CREATE POLICY "Users can view agents in their workspaces" ON agents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = agents.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage agents in their workspaces" ON agents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = agents.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Comments: Can view comments in workspaces you belong to
CREATE POLICY "Users can view comments in their agents" ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = comments.agent_id
        AND EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = agents.workspace_id
            AND wm.user_id = auth.uid()
        )
    )
  );

-- Message Logs: Can view messages in your workspaces
CREATE POLICY "Users can view message logs in their workspace" ON message_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = message_logs.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment daily stats
CREATE OR REPLACE FUNCTION increment_daily_stat(
  p_workspace_id UUID,
  p_agent_id UUID,
  p_stat_name TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_stats (workspace_id, agent_id, stat_date)
  VALUES (p_workspace_id, p_agent_id, CURRENT_DATE)
  ON CONFLICT (workspace_id, agent_id, stat_date) DO UPDATE SET
    total_messages = CASE WHEN p_stat_name = 'messages' THEN daily_stats.total_messages + p_increment ELSE daily_stats.total_messages END,
    total_comments = CASE WHEN p_stat_name = 'comments' THEN daily_stats.total_comments + p_increment ELSE daily_stats.total_comments END,
    total_dms = CASE WHEN p_stat_name = 'dms' THEN daily_stats.total_dms + p_increment ELSE daily_stats.total_dms END,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION log_audit(
  p_workspace_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_changes JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, changes)
  VALUES (p_workspace_id, p_user_id, p_action, p_resource_type, p_resource_id, p_changes);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 14. FACEBOOK EVENTS (Webhook events from Meta/Facebook)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fb_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- comment, message, comment_reply, comment_edit
  platform TEXT DEFAULT 'facebook', -- facebook, instagram
  raw_payload JSONB NOT NULL, -- Complete webhook payload
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  response_sent BOOLEAN DEFAULT false,
  response_data JSONB, -- Data about what response was sent
  error_message TEXT, -- If processing failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fb_events_workspace_id ON fb_events(workspace_id);
CREATE INDEX idx_fb_events_page_id ON fb_events(page_id);
CREATE INDEX idx_fb_events_processed ON fb_events(processed);
CREATE INDEX idx_fb_events_created_at ON fb_events(created_at);
CREATE INDEX idx_fb_events_event_type ON fb_events(event_type);

-- RLS policy for fb_events: Users can access events from their workspaces
CREATE POLICY "Users can view fb_events in their workspaces" ON fb_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = fb_events.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage fb_events" ON fb_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on user changes
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_update_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();

-- Auto-create workspace member when user signs up
CREATE OR REPLACE FUNCTION create_initial_workspace()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  -- Create initial workspace for new user
  INSERT INTO workspaces (owner_id, name, description)
  VALUES (NEW.id, NEW.business_name || '''s Workspace', 'Default workspace')
  RETURNING id INTO v_workspace_id;
  
  -- Add user as owner
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER new_user_workspace
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_initial_workspace();

-- ============================================================================
-- WORKSPACE INVITES (Team invitations with tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'staff', -- owner, admin, staff
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  accepted BOOLEAN DEFAULT false,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(workspace_id, email)
);

CREATE INDEX idx_workspace_invites_workspace_id ON workspace_invites(workspace_id);

-- ==========================================================================
-- 15. SUBSCRIPTIONS (PayPal / Mobile Money)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- paypal, mobile_money
  provider_subscription_id TEXT, -- e.g., PayPal subscription ID
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, cancelled, past_due
  next_billing_date TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS: Allow workspace members to select their workspace subscriptions
CREATE POLICY "Users can view subscriptions in their workspaces" ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = subscriptions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage subscriptions" ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==========================================================================
-- 16. MOBILE MONEY PAYMENTS (Manual receipts)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS mobile_money_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  receipt_url TEXT, -- URL to uploaded receipt (stored in Supabase storage or external)
  amount NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mobile_money_workspace_id ON mobile_money_payments(workspace_id);
CREATE INDEX idx_mobile_money_user_id ON mobile_money_payments(user_id);
CREATE INDEX idx_mobile_money_status ON mobile_money_payments(status);

-- RLS: Allow workspace members to view mobile money payments for their workspace
CREATE POLICY "Users can view mobile_money_payments in their workspaces" ON mobile_money_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = mobile_money_payments.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage mobile_money_payments" ON mobile_money_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==========================================================================
-- 17. PAYMENTS (Generic record of transactions)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  method TEXT NOT NULL, -- paypal, mobile_money
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_workspace_id ON payments(workspace_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

-- RLS: allow workspace members to view workspace payments
CREATE POLICY "Users can view payments in their workspaces" ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = payments.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage payments" ON payments FOR ALL
  USING (true)
  WITH CHECK (true);
CREATE INDEX idx_workspace_invites_email ON workspace_invites(email);
CREATE INDEX idx_workspace_invites_token ON workspace_invites(token);
CREATE INDEX idx_workspace_invites_accepted ON workspace_invites(accepted);
CREATE INDEX idx_workspace_invites_expires_at ON workspace_invites(expires_at);

-- Enable RLS on workspace_invites
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view invites for their workspaces
CREATE POLICY "Users can view workspace invites" ON workspace_invites FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspace_invites.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
);

-- RLS Policy: Only owners/admins can create invites
CREATE POLICY "Only admins can create invites" ON workspace_invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspace_invites.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
);

-- RLS Policy: Only owners/admins can update invites
CREATE POLICY "Only admins can update invites" ON workspace_invites FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspace_invites.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspace_invites.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
);

-- RLS Policy: Only owners/admins can delete invites
CREATE POLICY "Only admins can delete invites" ON workspace_invites FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspace_invites.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- 17. PAYMENTS (PayPal + Mobile Money)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD', -- USD, BWP, etc.
  method TEXT NOT NULL, -- paypal, mobile_money
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  paypal_order_id TEXT, -- For PayPal orders
  metadata JSONB, -- PayPal transaction ID, reference number, etc
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_workspace_id ON payments(workspace_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_method ON payments(method);

-- RLS: Users can view/insert payments for their workspaces
CREATE POLICY "Users can view payments in their workspaces" ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = payments.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create payments" ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = payments.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage payments" ON payments FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS mobile_money_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'BWP',
  phone_number TEXT NOT NULL,
  proof_url TEXT, -- screenshot/proof link
  reference_code TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_notes TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mobile_money_workspace_id ON mobile_money_payments(workspace_id);
CREATE INDEX idx_mobile_money_user_id ON mobile_money_payments(user_id);
CREATE INDEX idx_mobile_money_status ON mobile_money_payments(status);
CREATE INDEX idx_mobile_money_reference_code ON mobile_money_payments(reference_code);

-- RLS: Users can view/insert their mobile money payments
CREATE POLICY "Users can view mobile_money_payments in their workspaces" ON mobile_money_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = mobile_money_payments.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create mobile_money_payments" ON mobile_money_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = mobile_money_payments.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage mobile_money_payments" ON mobile_money_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 18. BILLING PLANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- free, starter, pro, enterprise
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10, 2),
  price_yearly NUMERIC(10, 2),
  included_monthly_usage BIGINT DEFAULT 0, -- Number of comments/messages
  included_features TEXT[], -- Features included in plan
  stripe_product_id TEXT, -- For Stripe integration later
  paypal_plan_id TEXT, -- For PayPal integration
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plans_name ON plans(name);
CREATE INDEX idx_plans_is_active ON plans(is_active);

-- ============================================================================
-- 19. SUBSCRIPTIONS (workspace-scoped)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT DEFAULT 'trial', -- trial, active, past_due, cancelled, paused
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, yearly
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  renewal_date TIMESTAMP,
  provider TEXT, -- paypal, stripe, momo (mobile money), manual
  provider_subscription_id TEXT, -- PayPal/Stripe subscription ID
  grace_period_days INT DEFAULT 7,
  is_on_grace_period BOOLEAN DEFAULT false,
  grace_period_ends_at TIMESTAMP,
  last_payment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP
);

CREATE INDEX idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_renewal_date ON subscriptions(renewal_date);

-- RLS: Users can view subscriptions for their workspaces
CREATE POLICY "Users can view subscriptions in their workspaces" ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = subscriptions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create subscriptions" ON subscriptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = subscriptions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update subscriptions in their workspaces" ON subscriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = subscriptions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage subscriptions" ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 20. BILLING PAYMENTS (all payment methods)
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  provider TEXT NOT NULL, -- paypal, stripe, momo, manual
  status TEXT DEFAULT 'pending', -- pending, completed, failed, refunded
  transaction_id TEXT, -- PayPal/Stripe transaction ID
  metadata JSONB, -- Payment-specific metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_payments_subscription_id ON billing_payments(subscription_id);
CREATE INDEX idx_billing_payments_workspace_id ON billing_payments(workspace_id);
CREATE INDEX idx_billing_payments_status ON billing_payments(status);
CREATE INDEX idx_billing_payments_provider ON billing_payments(provider);

-- RLS: Users can view payments for their workspaces
CREATE POLICY "Users can view billing_payments in their workspaces" ON billing_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = billing_payments.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage billing_payments" ON billing_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 21. MOBILE MONEY PAYMENTS (manual confirmation workflow)
-- ============================================================================
CREATE TABLE IF NOT EXISTS momo_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'BWP',
  reference_code TEXT NOT NULL UNIQUE, -- Unique identifier for tracking
  provider TEXT DEFAULT 'mtn', -- mtn, vodacom, airtel
  status TEXT DEFAULT 'pending', -- pending, confirmed, rejected, expired
  notes TEXT,
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX idx_momo_payments_subscription_id ON momo_payments(subscription_id);
CREATE INDEX idx_momo_payments_workspace_id ON momo_payments(workspace_id);
CREATE INDEX idx_momo_payments_status ON momo_payments(status);
CREATE INDEX idx_momo_payments_reference_code ON momo_payments(reference_code);
CREATE INDEX idx_momo_payments_created_at ON momo_payments(created_at);

-- RLS: Users can view momo payments for their workspaces
CREATE POLICY "Users can view momo_payments in their workspaces" ON momo_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = momo_payments.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage momo_payments" ON momo_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 22. BILLING EVENTS (audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- subscription_created, payment_received, renewal_failed, grace_period_started, etc
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES billing_payments(id) ON DELETE SET NULL,
  data JSONB, -- Event-specific details
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_events_workspace_id ON billing_events(workspace_id);
CREATE INDEX idx_billing_events_event_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_subscription_id ON billing_events(subscription_id);
CREATE INDEX idx_billing_events_created_at ON billing_events(created_at);

-- RLS: Users can view billing events for their workspaces
CREATE POLICY "Users can view billing_events in their workspaces" ON billing_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = billing_events.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage billing_events" ON billing_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANTS (Service Role for Admin Operations)
-- ============================================================================

-- Grant all permissions to authenticated users (RLS policies handle granularity)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Allow service_role to do everything (for admin operations)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
