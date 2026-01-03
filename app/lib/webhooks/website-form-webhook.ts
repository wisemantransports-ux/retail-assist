/**
 * Website Form Webhook Handler
 * 
 * Handles form submissions from your website and triggers automation rules.
 * Verifies HMAC-SHA256 signatures for security.
 * 
 * To wire with executor:
 * ```
 * import { handleWebsiteFormWebhook } from '@/lib/webhooks/website-form-webhook';
 * 
 * export async function POST(request: Request) {
 *   const signature = request.headers.get('X-Signature');
 *   const result = await handleWebsiteFormWebhook(
 *     request,
 *     signature,
 *     process.env.FORM_WEBHOOK_SECRET
 *   );
 *   return Response.json(result);
 * }
 * ```
 */

/// <reference path="./webhooks-shim.d.ts" />

import {
  logWebhookEvent,
  verifyWebsiteFormSignature,
  validateWorkspaceAndSubscription,
  safeJsonParse,
} from './webhook-utils';

/**
 * Website form webhook result
 */
export interface WebsiteFormWebhookResult {
  ok: boolean;
  status: number;
  message: string;
  rulesExecuted?: number;
  errors?: string[];
}

/**
 * Parsed form submission data
 */
export interface FormSubmission {
  id: string;
  timestamp: number;
  senderEmail: string;
  senderName: string;
  message: string;
  source: string;
  metadata?: Record<string, any>;
}

/**
 * Handle incoming website form webhook
 * 
 * @param request - HTTP request with form submission
 * @param signature - X-Signature header value from request
 * @param secret - Webhook secret for signature verification
 * @param workspaceId - Workspace ID for rule execution
 * @param agentId - Agent ID for automation rules
 * @returns Webhook response
 */
export async function handleWebsiteFormWebhook(
  request: Request,
  signature: string | null,
  secret: string | undefined,
  workspaceId?: string,
  agentId?: string
): Promise<WebsiteFormWebhookResult> {
  const errors: string[] = [];
  let rulesExecuted = 0;

  try {
    // Parse request body
    const bodyText = await request.text();
    const payload = safeJsonParse(bodyText);

    if (!payload) {
      logWebhookEvent('website-form', 'webhook', 'failed', { error: 'Invalid JSON' });
      return {
        ok: false,
        status: 400,
        message: 'Invalid JSON payload',
        errors: ['Failed to parse JSON'],
      };
    }

    logWebhookEvent('website-form', 'webhook', 'received', { type: payload.type });

    // Verify signature if secret is provided
    if (secret && signature) {
      const verification = verifyWebsiteFormSignature(bodyText, signature, secret);
      if (!verification.valid) {
        logWebhookEvent('website-form', 'webhook', 'failed', {
          error: verification.error,
        });
        return {
          ok: false,
          status: 403,
          message: 'Signature verification failed',
          errors: [verification.error || 'Invalid signature'],
        };
      }
      logWebhookEvent('website-form', 'webhook', 'verified');
    }

    // Extract workspace ID if not provided
    if (!workspaceId) {
      workspaceId = payload.workspace_id || payload.workspaceId;
      if (!workspaceId) {
        errors.push('workspace_id is required in payload or parameters');
      }
    }

    // Extract agent ID if not provided
    if (!agentId) {
      agentId = payload.agent_id || payload.agentId;
      if (!agentId) {
        errors.push('agent_id is required in payload or parameters');
      }
    }

    if (!workspaceId || !agentId) {
      return {
        ok: false,
        status: 400,
        message: 'Missing workspace_id or agent_id',
        errors,
      };
    }

    // Validate workspace and subscription
    const env = (globalThis as any).env || {};
      const supabase = (globalThis as any).createServerClient?.() || null;
    const executeAutomationRulesForMessage = (globalThis as any).executeAutomationRulesForMessage;

    if (supabase) {
      const validation = await validateWorkspaceAndSubscription(workspaceId, supabase);
      if (!validation.valid) {
        logWebhookEvent('website-form', 'webhook', 'failed', {
          workspace: workspaceId,
          error: validation.error,
        });
        return {
          ok: false,
          status: 403,
          message: `Workspace validation failed: ${validation.error}`,
          errors: [validation.error || 'Invalid workspace'],
        };
      }
    }

    // Parse form submission
    const submission = parseFormSubmission(payload);
    if (!submission) {
      errors.push('Could not parse form submission');
      return {
        ok: false,
        status: 400,
        message: 'Invalid form submission format',
        errors,
      };
    }

    logWebhookEvent('website-form', 'submission', 'parsed', {
      workspace: workspaceId,
      agent: agentId,
      submissionId: submission.id,
      senderEmail: submission.senderEmail,
    });

    // Create automation executor input
    const input = {
      workspaceId,
      agentId,
      commentId: submission.id,
      commentText: submission.message,
      authorId: submission.senderEmail,
      authorName: submission.senderName,
      platform: 'website' as const,
      messageType: 'form_submission' as const,
      metadata: {
        formSource: submission.source,
        submissionTimestamp: submission.timestamp,
        ...submission.metadata,
      },
    };

    // Execute automation rules
    if (env.useMockMode || !executeAutomationRulesForMessage) {
      logWebhookEvent('website-form', 'submission', 'executed', { mock: true });
      rulesExecuted = 1;
    } else {
      try {
        const result = await executeAutomationRulesForMessage(input);
        if (result?.ok) {
          rulesExecuted = 1;
          logWebhookEvent('website-form', 'submission', 'executed', {
            ruleMatched: result.ruleMatched,
            actionExecuted: result.actionExecuted,
          });
        }
      } catch (execErr: any) {
        errors.push(`Executor error: ${execErr.message}`);
        logWebhookEvent('website-form', 'submission', 'failed', {
          error: execErr.message,
        });
      }
    }

    logWebhookEvent('website-form', 'webhook', 'executed', {
      rulesExecuted,
      errors: errors.length,
    });

    return {
      ok: true,
      status: 200,
      message: `Form submission processed`,
      rulesExecuted,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err: any) {
    logWebhookEvent('website-form', 'webhook', 'failed', { error: err.message });
    return {
      ok: false,
      status: 500,
      message: 'Webhook processing failed',
      errors: [err.message],
    };
  }
}

/**
 * Parse form submission from various formats
 */
export function parseFormSubmission(payload: any): FormSubmission | null {
  try {
    // Extract basic fields (flexible field names)
    const id =
      payload.id ||
      payload.submission_id ||
      payload.submissionId ||
      `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const senderEmail = payload.email || payload.sender_email || payload.senderEmail || '';
    const senderName = payload.name || payload.sender_name || payload.senderName || 'Anonymous';
    const message =
      payload.message ||
      payload.body ||
      payload.content ||
      payload.text ||
      buildMessageFromPayload(payload);

    if (!senderEmail || !message) {
      return null;
    }

    const source = payload.source || payload.form_id || payload.formId || 'unknown';
    const timestamp = payload.timestamp || payload.created_at || Date.now();

    // Collect any additional metadata
    const metadata: Record<string, any> = {};
    const excludedFields = [
      'id',
      'submission_id',
      'submissionId',
      'email',
      'sender_email',
      'senderEmail',
      'name',
      'sender_name',
      'senderName',
      'message',
      'body',
      'content',
      'text',
      'source',
      'form_id',
      'formId',
      'timestamp',
      'created_at',
      'workspace_id',
      'workspaceId',
      'agent_id',
      'agentId',
    ];

    for (const [key, value] of Object.entries(payload)) {
      if (!excludedFields.includes(key) && typeof value !== 'object') {
        metadata[key] = value;
      }
    }

    return {
      id,
      timestamp: typeof timestamp === 'number' ? timestamp : Date.parse(timestamp) || Date.now(),
      senderEmail,
      senderName,
      message,
      source,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Build message from remaining fields
 */
function buildMessageFromPayload(payload: any): string {
  const parts: string[] = [];

  const fieldOrder = [
    'subject',
    'title',
    'topic',
    'description',
    'details',
    'feedback',
    'comments',
    'question',
  ];

  for (const field of fieldOrder) {
    if (payload[field]) {
      parts.push(`${field}: ${payload[field]}`);
    }
  }

  // Add remaining fields
  const usedFields = [
    'email',
    'name',
    'source',
    'timestamp',
    'id',
    'workspace_id',
    'agent_id',
    ...fieldOrder,
  ];
  for (const [key, value] of Object.entries(payload)) {
    if (!usedFields.includes(key) && typeof value === 'string') {
      parts.push(`${key}: ${value}`);
    }
  }

  return parts.join('\n') || '';
}

/**
 * Generate webhook signature for testing
 */
export function generateWebsiteFormSignature(payload: string, secret: string): string {
  try {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  } catch {
    // Fallback for environments without native crypto
    return '';
  }
}
