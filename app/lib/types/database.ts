/**
 * Database Types
 * Auto-generated from Supabase schema
 * Use these types for all database interactions
 */

// ============================================================================
// BILLING TYPES
// ============================================================================

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly?: number;
  price_currency_bwp: number;
  price_yearly?: number;
  ai_token_limit_monthly: number;
  included_monthly_usage: number; // Optional, as per API response
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  business_name?: string;
  business_description?: string;
  country?: string;
  time_zone?: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'enterprise';
  api_key: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ============================================================================
// WORKSPACE TYPES
// ============================================================================

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  logo_url?: string;
  meta_page_id?: string;
  meta_page_access_token?: string; // Encrypted in production
  whatsapp_business_account_id?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_api_token?: string; // Encrypted
  website_domain?: string;
  created_at: string;
  updated_at: string;
}

export type WorkspaceMemberRole = 'owner' | 'admin' | 'staff' | 'member' | 'viewer';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  invited_by?: string;
  invited_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceMemberRole;
  token: string;
  accepted: boolean;
  accepted_by?: string;
  accepted_at?: string;
  expires_at: string;
  created_at: string;
  created_by: string;
}

export interface WorkspaceInviteInput {
  email: string;
  role: WorkspaceMemberRole;
}

export interface AcceptInviteInput {
  token: string;
  userId: string;
}

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo';

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  system_prompt: string;
  greeting?: string;
  fallback?: string;
  model: AgentModel;
  temperature: number;
  max_tokens: number;
  api_key: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export type Platform = 'facebook' | 'instagram' | 'website' | 'whatsapp';

export interface Comment {
  id: string;
  agent_id: string;
  platform: Platform;
  platform_comment_id?: string;
  author_id?: string;
  author_name?: string;
  author_email?: string;
  content: string;
  post_id?: string;
  processed: boolean;
  processed_at?: string;
  bot_reply?: string;
  bot_reply_id?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DIRECT MESSAGE TYPES
// ============================================================================

export type MessagePlatform = 'email' | 'facebook_messenger' | 'whatsapp' | 'instagram_dm';
export type MessageLogStatus = 'sent' | 'failed' | 'read' | 'replied';

export interface DirectMessage {
  id: string;
  workspace_id: string;
  agent_id: string;
  recipient_id: string;
  recipient_name?: string;
  sender_display: string;
  content: string;
  platform: MessagePlatform;
  platform_message_id?: string;
  status: MessageLogStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MESSAGE LOG TYPES
// ============================================================================

export interface MessageLog {
  id: string;
  agent_id: string;
  workspace_id: string;
  session_id?: string;
  user_message: string;
  assistant_message: string;
  tokens_used?: number;
  cost?: number;
  user_id?: string;
  platform?: Platform;
  metadata?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// AUTOMATION RULE TYPES
// ============================================================================

export type AutomationRuleType = 'comment_to_dm' | 'keyword_reply' | 'scheduled_message';
export type TriggerType = 'comment' | 'keyword' | 'time' | 'manual';
export type ActionType = 'send_dm' | 'send_public_reply' | 'send_email';

export interface AutomationRule {
  id: string;
  workspace_id: string;
  agent_id: string;
  name: string;
  description?: string;
  type: AutomationRuleType;
  enabled: boolean;
  
  // Trigger configuration
  trigger_type?: TriggerType;
  trigger_words?: string[];
  trigger_platforms?: Platform[];
  
  // Action configuration
  action_type?: ActionType;
  send_public_reply?: boolean;
  public_reply_template?: string;
  send_private_reply?: boolean;
  private_reply_template?: string;
  
  // Advanced options
  auto_skip_replies?: boolean;
  skip_if_keyword_present?: string[];
  delay_seconds?: number;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

export type IntegrationProvider = 'facebook' | 'whatsapp' | 'website_widget' | 'slack' | 'zapier';

export interface Integration {
  id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  name: string;
  enabled: boolean;
  
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  
  config?: Record<string, any>;
  
  total_requests: number;
  last_sync_at?: string;
  last_error?: string;
  last_error_at?: string;
  
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ============================================================================
// BILLING TYPES
// ============================================================================

export type PlanId = 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'paused';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void' | 'uncollectible';

export interface Invoice {
  id: string;
  workspace_id: string;
  subscription_id?: string;
  stripe_invoice_id?: string;
  amount_cents: number;
  amount_formatted: string;
  currency: string;
  status: InvoiceStatus;
  invoice_date: string;
  due_date?: string;
  paid_at?: string;
  created_at: string;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface DailyStat {
  id: string;
  workspace_id: string;
  agent_id?: string;
  stat_date: string;
  
  total_messages: number;
  total_comments: number;
  total_dms: number;
  processed_comments: number;
  
  user_count: number;
  unique_users: number;
  
  avg_response_time_ms?: number;
  total_tokens_used: number;
  total_cost?: number;
  
  total_conversations: number;
  completed_conversations: number;
  conversation_completion_rate?: number;
  
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ANALYTICS SUMMARY (Aggregated data)
// ============================================================================

export interface AnalyticsSummary {
  totalMessages: number;
  totalComments: number;
  totalDMs: number;
  processedComments: number;
  uniqueUsers: number;
  avgResponseTime: number;
  totalTokensUsed: number;
  totalCost: number;
  conversionRate: number;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export type AuditAction = 'created' | 'updated' | 'deleted' | 'sent' | 'received';
export type AuditResourceType = 'agent' | 'rule' | 'integration' | 'comment' | 'user';

export interface AuditLog {
  id: string;
  workspace_id: string;
  user_id?: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id?: string;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================================
// EXTERNAL API TYPES (Meta, OpenAI, etc.)
// ============================================================================

export interface FacebookComment {
  id: string;
  message: string;
  created_time: string;
  from: {
    name: string;
    email?: string;
    id: string;
  };
  object: string; // 'comment', 'post'
  story?: string;
  permalink_url?: string;
  parent?: {
    created_time: string;
    from: {
      name: string;
      id: string;
    };
    id: string;
  };
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// FACEBOOK EVENTS TYPES
// ============================================================================

export interface FacebookEvent {
  id: string;
  workspace_id: string;
  page_id: string;
  event_type: 'comment' | 'message' | 'comment_reply' | 'comment_edit';
  platform: 'facebook' | 'instagram';
  raw_payload: Record<string, any>;
  processed: boolean;
  processed_at?: string;
  automation_rule_id?: string;
  response_sent: boolean;
  response_data?: Record<string, any>;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

export interface CreateAgentInput {
  name: string;
  description?: string;
  system_prompt: string;
  greeting?: string;
  fallback?: string;
  model?: AgentModel;
  temperature?: number;
  max_tokens?: number;
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  id: string;
}

export interface CreateAutomationRuleInput {
  name: string;
  description?: string;
  type: AutomationRuleType;
  agent_id: string;
  trigger_words?: string[];
  trigger_platforms?: Platform[];
  send_public_reply?: boolean;
  public_reply_template?: string;
  send_private_reply?: boolean;
  private_reply_template?: string;
  auto_skip_replies?: boolean;
  delay_seconds?: number;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  logo_url?: string;
}

// ============================================================================
// BILLING TYPES
// ============================================================================

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  price_monthly?: number;
  price_yearly?: number;
  included_monthly_usage: number;
  included_features?: string[];
  stripe_product_id?: string;
  paypal_plan_id?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type BillingCycle = 'monthly' | 'yearly';
export type PaymentProvider = 'paypal' | 'stripe' | 'momo' | 'manual';

export interface Subscription {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start?: string;
  current_period_end?: string;
  renewal_date?: string;
  provider: PaymentProvider;
  provider_subscription_id?: string;
  grace_period_days: number;
  is_on_grace_period: boolean;
  grace_period_ends_at?: string;
  last_payment_date?: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface BillingPayment {
  id: string;
  subscription_id: string;
  workspace_id: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  transaction_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type MomoPaymentStatus = 'pending' | 'confirmed' | 'rejected' | 'expired';

export interface MobileMoneyPayment {
  id: string;
  subscription_id: string;
  workspace_id: string;
  phone_number: string;
  amount: number;
  currency: string;
  reference_code: string;
  provider: 'mtn' | 'vodacom' | 'airtel';
  status: MomoPaymentStatus;
  notes?: string;
  confirmed_by?: string;
  created_at: string;
  confirmed_at?: string;
  expires_at: string;
}

export interface BillingEvent {
  id: string;
  workspace_id: string;
  event_type: string;
  subscription_id?: string;
  payment_id?: string;
  data?: Record<string, any>;
  created_at: string;
}

export interface ManualPayment {
  id: string;
  workspace_id: string;
  user_id: string;
  amount: number;
  currency: string;
  provider: string;
  status: 'pending' | 'approved' | 'rejected';
  proof_url?: string;
  notes?: string;
  approved_by?: string;
  created_at: string;
  approved_at?: string;
}

// ============================================================================
// EMPLOYEES DASHBOARD TYPES
// ============================================================================

export type EmployeeRole = 'super_admin' | 'admin' | 'employee' | 'platform_staff';

export interface Employee {
  id: string;
  user_id: string;
  business_id?: string; // null for Retail Assist employees
  role: EmployeeRole;
  created_at: string;
  updated_at: string;
}

export type MessageChannel = 'facebook' | 'instagram' | 'whatsapp' | 'website_chat';
export type EmployeeMessageStatus = 'new' | 'in_progress' | 'escalated' | 'completed';

export interface Message {
  id: string;
  sender_id: string;
  channel: MessageChannel;
  content: string;
  ai_response?: string;
  ai_confidence?: number;
  status: EmployeeMessageStatus;
  assigned_to_employee_id?: string;
  escalated_to_admin_id?: string;
  business_id?: string;
  created_at: string;
  updated_at: string;
}

export type QueueStatus = 'pending' | 'assigned' | 'completed';

export interface MessageQueue {
  id: string;
  message_id: string;
  employee_id: string;
  status: QueueStatus;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface MessageWithQueue extends Message {
  queue_entry?: MessageQueue;
}

export interface AIResponseSuggestion {
  response: string;
  confidence: number;
}

export interface MessageResponse {
  message_id: string;
  response: string;
  escalate?: boolean;
}
