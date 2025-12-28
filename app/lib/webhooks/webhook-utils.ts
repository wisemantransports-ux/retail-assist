/**
 * Webhook Utilities
 * 
 * Shared utilities for webhook signature verification, payload validation, and logging.
 * Supports: Facebook, Instagram, WhatsApp, Website forms.
 */

/**
 * Webhook signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Parsed webhook payload (normalized across platforms)
 */
export interface NormalizedWebhookPayload {
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'website';
  workspaceId: string;
  agentId: string;
  messageId: string;
  messageText: string;
  authorId: string;
  authorName?: string;
  postId?: string; // For comments
  pageAccessToken?: string; // For Facebook/Instagram
  timestamp: number;
  raw: any; // Original payload for debugging
}

/**
 * Log webhook event
 */
export function logWebhookEvent(
  platform: string,
  event: string,
  status: 'received' | 'verified' | 'parsed' | 'executed' | 'failed',
  metadata?: Record<string, any>
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    platform,
    event,
    status,
    ...metadata,
  };
  
  if (status === 'failed') {
    console.error(`[Webhook] ${platform.toUpperCase()} ${event} ${status}:`, logEntry);
  } else {
    console.log(`[Webhook] ${platform.toUpperCase()} ${event} ${status}:`, logEntry);
  }
}

/**
 * Verify Facebook webhook signature
 * Facebook sends X-Hub-Signature-256 header: sha256=<signature>
 */
export function verifyFacebookSignature(
  payload: string,
  signature: string | undefined,
  appSecret: string
): SignatureVerificationResult {
  if (!signature) {
    return {
      valid: false,
      error: 'Missing X-Hub-Signature-256 header',
    };
  }

  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', appSecret)
      .update(payload, 'utf8')
      .digest('hex');

    const expectedSignature = `sha256=${hash}`;
    const isValid = signature === expectedSignature;

    return {
      valid: isValid,
      error: isValid ? undefined : 'Signature mismatch',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Signature verification failed: ${err.message}`,
    };
  }
}

/**
 * Verify Instagram webhook signature
 * Instagram uses the same mechanism as Facebook (X-Hub-Signature-256)
 */
export function verifyInstagramSignature(
  payload: string,
  signature: string | undefined,
  appSecret: string
): SignatureVerificationResult {
  // Instagram uses the same signature mechanism as Facebook
  return verifyFacebookSignature(payload, signature, appSecret);
}

/**
 * Verify WhatsApp webhook signature
 * WhatsApp sends X-Twilio-Signature header with HMAC-SHA1 of request body
 */
export function verifyWhatsAppSignature(
  payload: string,
  signature: string | undefined,
  authToken: string,
  webhookUrl: string
): SignatureVerificationResult {
  if (!signature) {
    return {
      valid: false,
      error: 'Missing X-Twilio-Signature header',
    };
  }

  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha1', authToken)
      .update(webhookUrl + payload, 'utf8')
      .digest('base64');

    const isValid = hash === signature;

    return {
      valid: isValid,
      error: isValid ? undefined : 'Signature mismatch',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Signature verification failed: ${err.message}`,
    };
  }
}

/**
 * Verify website form webhook signature
 * Simple HMAC-SHA256 verification for website forms
 */
export function verifyWebsiteSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): SignatureVerificationResult {
  if (!signature) {
    return {
      valid: false,
      error: 'Missing X-Webhook-Signature header',
    };
  }

  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    const isValid = signature === hash;

    return {
      valid: isValid,
      error: isValid ? undefined : 'Signature mismatch',
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Signature verification failed: ${err.message}`,
    };
  }
}

/**
 * Validate workspace and subscription
 * (Reused from executor logic)
 */
export async function validateWorkspaceAndSubscription(
  workspaceId: string,
  supabase: any
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check workspace exists
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id, subscription_status')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      return { valid: false, error: 'Workspace not found' };
    }

    // Check subscription status
    if (workspace.subscription_status !== 'active') {
      return { valid: false, error: 'Subscription not active' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Validation failed: ${err.message}` };
  }
}

/**
 * Extract workspace ID from webhook payload
 * Different platforms may store this differently
 */
export function extractWorkspaceIdFromPayload(
  payload: any,
  platform: string
): string | null {
  // Try common locations
  if (payload.workspace_id) return payload.workspace_id;
  if (payload.meta?.workspace_id) return payload.meta.workspace_id;
  if (payload.entry?.[0]?.messaging?.[0]?.workspace_id) {
    return payload.entry[0].messaging[0].workspace_id;
  }

  // Platform-specific extraction (map from meta fields)
  switch (platform) {
    case 'facebook':
    case 'instagram':
      // Page ID should map to workspace via agent configuration
      if (payload.entry?.[0]?.id) {
        return `workspace_${payload.entry[0].id}`;
      }
      break;
    case 'whatsapp':
      // Account ID should map to workspace
      if (payload.account_id) {
        return `workspace_${payload.account_id}`;
      }
      break;
  }

  return null;
}

/**
 * Extract agent ID from webhook payload
 * Requires metadata or configuration lookup
 */
export function extractAgentIdFromPayload(
  payload: any,
  platform: string
): string | null {
  // Try direct field
  if (payload.agent_id) return payload.agent_id;
  if (payload.meta?.agent_id) return payload.meta.agent_id;

  // For platform webhooks, agent ID must be retrieved from config
  // This is done at the handler level
  return null;
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch (err) {
    return null;
  }
}

/**
 * Mock signature verification (for development/testing)
 */
export function verifySignatureMock(
  _payload: string,
  _signature: string | undefined,
  _secret: string
): SignatureVerificationResult {
  return { valid: true };
}

/**
 * Alias for verifyWebsiteSignature (consistency)
 */
export const verifyWebsiteFormSignature = verifyWebsiteSignature;

/**
 * Parse comment payload from webhook
 */
export function parseCommentPayload(payload: any): any {
  try {
    if (payload.entry?.[0]?.changes?.[0]?.value) {
      const value = payload.entry[0].changes[0].value;
      return {
        id: value.id,
        text: value.message || value.text,
        author: value.from?.name || value.from?.id,
        authorId: value.from?.id,
        postId: value.post_id,
        timestamp: value.created_time,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse DM payload from webhook
 */
export function parseDmPayload(payload: any): any {
  try {
    if (payload.entry?.[0]?.messaging?.[0]) {
      const msg = payload.entry[0].messaging[0];
      return {
        id: msg.message?.mid || msg.message?.id,
        text: msg.message?.text || '',
        sender: msg.sender?.id,
        recipient: msg.recipient?.id,
        timestamp: msg.timestamp,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse generic webhook event
 */
export function parseWebhookEvent(payload: any, platform: string): any {
  try {
    switch (platform) {
      case 'facebook':
      case 'instagram':
        return parseCommentPayload(payload) || parseDmPayload(payload);
      case 'whatsapp':
        return payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      case 'website':
        return payload;
      default:
        return payload;
    }
  } catch {
    return null;
  }
}
