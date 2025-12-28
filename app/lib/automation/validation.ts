/**
 * Input validation and types for automation rules
 */
export const TRIGGER_TYPES = ['comment', 'keyword', 'time', 'manual'] as const;
export const ACTION_TYPES = ['send_dm', 'send_public_reply', 'send_email', 'send_webhook'] as const;
export const RULE_TYPES = ['comment_to_dm', 'keyword_reply', 'scheduled_message'] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];
export type ActionType = (typeof ACTION_TYPES)[number];
export type RuleType = (typeof RULE_TYPES)[number];

export interface CreateAutomationRuleInput {
  name: string;
  description?: string;
  agent_id: string;
  type: RuleType;
  trigger_type: TriggerType;
  trigger_words?: string[];
  trigger_platforms?: string[];
  action_type: ActionType;
  send_public_reply?: boolean;
  public_reply_template?: string;
  send_private_reply?: boolean;
  private_reply_template?: string;
  auto_skip_replies?: boolean;
  skip_if_keyword_present?: string[];
  delay_seconds?: number;
  enabled?: boolean;
}

export interface UpdateAutomationRuleInput {
  name?: string;
  description?: string;
  agent_id?: string;
  type?: RuleType;
  trigger_type?: TriggerType;
  trigger_words?: string[];
  trigger_platforms?: string[];
  action_type?: ActionType;
  send_public_reply?: boolean;
  public_reply_template?: string;
  send_private_reply?: boolean;
  private_reply_template?: string;
  auto_skip_replies?: boolean;
  skip_if_keyword_present?: string[];
  delay_seconds?: number;
  enabled?: boolean;
}

/**
 * Time-based trigger configuration fields
 */
export interface TimeTriggerFields {
  scheduled_time?: string; // ISO 8601 datetime (one-time)
  recurrence_pattern?: string; // CRON pattern (recurring)
  timezone?: string; // Timezone (default: UTC)
  message_template?: string; // Content to send when triggered
  last_executed_at?: string; // Last execution timestamp
}

/**
 * Manual trigger configuration fields
 */
export interface ManualTriggerFields {
  message_template?: string; // Default content
}

/**
 * Email action configuration fields
 */
export interface EmailActionFields {
  email_recipients: string[]; // Email addresses
  subject_template: string; // Subject with {variables}
  body_template: string; // Body with {variables}
  use_ai_body?: boolean; // AI-generate body
}

/**
 * Webhook action configuration fields
 */
export interface WebhookActionFields {
  webhook_url: string; // Target URL
  request_method?: 'POST' | 'PUT' | 'PATCH'; // HTTP method
  headers?: Record<string, string>; // Custom headers
  body_template?: string; // JSON body template
}

/**
 * Extended rule creation input with all trigger/action configurations
 */
export interface CreateAutomationRuleInputExtended extends CreateAutomationRuleInput {
  // Time trigger fields
  scheduled_time?: string;
  recurrence_pattern?: string;
  timezone?: string;

  // Manual trigger fields
  message_template?: string;

  // Email action fields
  email_recipients?: string[];
  subject_template?: string;
  body_template?: string;
  use_ai_body?: boolean;

  // Webhook action fields
  webhook_url?: string;
  request_method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
}

/**
 * Extended rule update input with all trigger/action configurations
 */
export interface UpdateAutomationRuleInputExtended extends UpdateAutomationRuleInput {
  // Time trigger fields
  scheduled_time?: string;
  recurrence_pattern?: string;
  timezone?: string;

  // Manual trigger fields
  message_template?: string;

  // Email action fields
  email_recipients?: string[];
  subject_template?: string;
  body_template?: string;
  use_ai_body?: boolean;

  // Webhook action fields
  webhook_url?: string;
  request_method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
}

/**
 * Execution result extended with all action types
 */
export interface ExecuteAutomationResultExtended {
  ok: boolean;
  ruleMatched: boolean;
  actionExecuted: boolean;
  dmSent?: boolean;
  replySent?: boolean;
  emailSent?: boolean;
  webhookCalled?: boolean;
  error?: string;
}

/**
 * Validate create request
 */
export function validateCreateInput(input: any): { valid: boolean; error?: string } {
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    return { valid: false, error: 'name is required and must be a non-empty string' };
  }

  if (!input.agent_id || typeof input.agent_id !== 'string') {
    return { valid: false, error: 'agent_id is required and must be a string' };
  }

  if (!input.type || !RULE_TYPES.includes(input.type)) {
    return { valid: false, error: `type must be one of: ${RULE_TYPES.join(', ')}` };
  }

  if (!input.trigger_type || !TRIGGER_TYPES.includes(input.trigger_type)) {
    return { valid: false, error: `trigger_type must be one of: ${TRIGGER_TYPES.join(', ')}` };
  }

  if (!input.action_type || !ACTION_TYPES.includes(input.action_type)) {
    return { valid: false, error: `action_type must be one of: ${ACTION_TYPES.join(', ')}` };
  }

  // Validate optional arrays
  if (input.trigger_words && !Array.isArray(input.trigger_words)) {
    return { valid: false, error: 'trigger_words must be an array' };
  }

  if (input.trigger_platforms && !Array.isArray(input.trigger_platforms)) {
    return { valid: false, error: 'trigger_platforms must be an array' };
  }

  if (input.skip_if_keyword_present && !Array.isArray(input.skip_if_keyword_present)) {
    return { valid: false, error: 'skip_if_keyword_present must be an array' };
  }

  if (input.delay_seconds !== undefined && (typeof input.delay_seconds !== 'number' || input.delay_seconds < 0)) {
    return { valid: false, error: 'delay_seconds must be a non-negative number' };
  }

  return { valid: true };
}

/**
 * Validate update request
 */
export function validateUpdateInput(input: any): { valid: boolean; error?: string } {
  // All fields optional for updates, but validate those that are provided
  if (input.name !== undefined && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
    return { valid: false, error: 'name must be a non-empty string' };
  }

  if (input.type !== undefined && !RULE_TYPES.includes(input.type)) {
    return { valid: false, error: `type must be one of: ${RULE_TYPES.join(', ')}` };
  }

  if (input.trigger_type !== undefined && !TRIGGER_TYPES.includes(input.trigger_type)) {
    return { valid: false, error: `trigger_type must be one of: ${TRIGGER_TYPES.join(', ')}` };
  }

  if (input.action_type !== undefined && !ACTION_TYPES.includes(input.action_type)) {
    return { valid: false, error: `action_type must be one of: ${ACTION_TYPES.join(', ')}` };
  }

  if (input.trigger_words !== undefined && !Array.isArray(input.trigger_words)) {
    return { valid: false, error: 'trigger_words must be an array' };
  }

  if (input.trigger_platforms !== undefined && !Array.isArray(input.trigger_platforms)) {
    return { valid: false, error: 'trigger_platforms must be an array' };
  }

  if (input.skip_if_keyword_present !== undefined && !Array.isArray(input.skip_if_keyword_present)) {
    return { valid: false, error: 'skip_if_keyword_present must be an array' };
  }

  if (input.delay_seconds !== undefined && (typeof input.delay_seconds !== 'number' || input.delay_seconds < 0)) {
    return { valid: false, error: 'delay_seconds must be a non-negative number' };
  }

  return { valid: true };
}
