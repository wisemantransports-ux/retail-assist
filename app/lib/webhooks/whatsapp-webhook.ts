/**
 * WhatsApp Webhook Handler
 * 
 * Integrates WhatsApp messages with the automation executor.
 * Supports incoming messages and status updates.
 * 
 * To wire with executor:
 * ```
 * import { handleWhatsAppWebhook } from '@/lib/webhooks/whatsapp-webhook';
 * 
 * export async function POST(request: Request) {
 *   const result = await handleWhatsAppWebhook(request);
 *   return Response.json(result);
 * }
 * ```
 */

/// <reference path="./webhooks-shim.d.ts" />

import {
  logWebhookEvent,
  verifyWhatsAppSignature,
  validateWorkspaceAndSubscription,
  extractWorkspaceIdFromPayload,
  safeJsonParse,
} from './webhook-utils';

/**
 * WhatsApp webhook handler result
 */
export interface WhatsAppWebhookResult {
  ok: boolean;
  status: number;
  message: string;
  rulesExecuted?: number;
  errors?: string[];
}

/**
 * Handle incoming WhatsApp webhook
 * 
 * @param request - HTTP request with webhook payload
 * @param authToken - WhatsApp Business Account Token
 * @param webhookUrl - Your webhook URL (for signature verification)
 * @returns Webhook response
 */
export async function handleWhatsAppWebhook(
  request: Request,
  authToken: string,
  webhookUrl: string
): Promise<WhatsAppWebhookResult> {
  const errors: string[] = [];
  let rulesExecuted = 0;

  try {
    // Parse request body
    const bodyText = await request.text();
    const payload = safeJsonParse(bodyText);

    if (!payload) {
      logWebhookEvent('whatsapp', 'webhook', 'failed', { error: 'Invalid JSON' });
      return {
        ok: false,
        status: 400,
        message: 'Invalid JSON payload',
        errors: ['Failed to parse JSON'],
      };
    }

    logWebhookEvent('whatsapp', 'webhook', 'received', { changes: payload.entry?.length });

    // Verify signature
    const signature = request.headers.get('X-Twilio-Signature');
    const verification = verifyWhatsAppSignature(bodyText, signature, authToken, webhookUrl);

    if (!verification.valid) {
      logWebhookEvent('whatsapp', 'webhook', 'failed', { error: verification.error });
      return {
        ok: false,
        status: 403,
        message: 'Signature verification failed',
        errors: [verification.error || 'Invalid signature'],
      };
    }

    logWebhookEvent('whatsapp', 'webhook', 'verified');

    // Extract and process webhook events
    if (!payload.entry || !Array.isArray(payload.entry)) {
      return {
        ok: true,
        status: 200,
        message: 'No entries to process',
      };
    }

    const env = (globalThis as any).env || {};
    const supabase = (globalThis as any).createServerClient?.() || null;
    const executeAutomationRulesForMessage = (globalThis as any).executeAutomationRulesForMessage;

    // Process each entry
    for (const entry of payload.entry) {
      const workspaceId = extractWorkspaceIdFromPayload(payload, 'whatsapp');

      if (!workspaceId) {
        errors.push('Could not extract workspace ID from payload');
        continue;
      }

      // Validate workspace and subscription
      if (supabase) {
        const validation = await validateWorkspaceAndSubscription(workspaceId, supabase);
        if (!validation.valid) {
          logWebhookEvent('whatsapp', 'webhook', 'failed', {
            workspace: workspaceId,
            error: validation.error,
          });
          errors.push(`Workspace validation failed: ${validation.error}`);
          continue;
        }
      }

      // Get agent for WhatsApp
      let agentId = null;
      if (supabase) {
        const { data: agent } = await supabase
          .from('agents')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('platform', 'whatsapp')
          .limit(1)
          .single();
        agentId = agent?.id;
      }

      if (!agentId) {
        errors.push('Could not find WhatsApp agent for workspace');
        continue;
      }

      // Process changes (messages and status updates)
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          try {
            if (change.field !== 'messages') {
              continue;
            }

            const value = change.value;

            // Skip status updates, only process messages
            if (value.statuses && Array.isArray(value.statuses)) {
              logWebhookEvent('whatsapp', 'status', 'received', {
                statusCount: value.statuses.length,
              });
              continue;
            }

            // Process incoming messages
            if (value.messages && Array.isArray(value.messages)) {
              for (const msg of value.messages) {
                try {
                  // Skip outgoing messages
                  if (msg.direction === 'outbound') {
                    continue;
                  }

                  // Extract message content
                  let messageText = '';
                  if (msg.type === 'text') {
                    messageText = msg.text?.body || '';
                  } else if (msg.type === 'audio') {
                    messageText = '[Audio message]';
                  } else if (msg.type === 'image') {
                    messageText = '[Image message]';
                  } else if (msg.type === 'video') {
                    messageText = '[Video message]';
                  } else if (msg.type === 'document') {
                    messageText = `[Document: ${msg.document?.filename || 'Unknown'}]`;
                  } else {
                    messageText = `[${msg.type || 'unknown'} message]`;
                  }

                  const senderProfile = value.contacts?.[0] || {};
                  const input = {
                    workspaceId,
                    agentId,
                    commentId: msg.id || `wa_${Date.now()}`,
                    commentText: messageText,
                    authorId: msg.from,
                    authorName: senderProfile.profile?.name || msg.from,
                    platform: 'whatsapp' as const,
                    messageType: 'message' as const,
                  };

                  logWebhookEvent('whatsapp', 'message', 'parsed', {
                    workspace: workspaceId,
                    agent: agentId,
                    messageId: input.commentId,
                  });

                  if (env.useMockMode || !executeAutomationRulesForMessage) {
                    logWebhookEvent('whatsapp', 'message', 'executed', { mock: true });
                    rulesExecuted++;
                  } else {
                    try {
                      const result = await executeAutomationRulesForMessage(input);
                      if (result?.ok) {
                        rulesExecuted++;
                        logWebhookEvent('whatsapp', 'message', 'executed', {
                          ruleMatched: result.ruleMatched,
                          actionExecuted: result.actionExecuted,
                        });
                      }
                    } catch (execErr: any) {
                      errors.push(`Executor error: ${execErr.message}`);
                      logWebhookEvent('whatsapp', 'message', 'failed', {
                        error: execErr.message,
                      });
                    }
                  }
                } catch (msgErr: any) {
                  errors.push(`Message processing error: ${msgErr.message}`);
                }
              }
            }
          } catch (changeErr: any) {
            errors.push(`Change processing error: ${changeErr.message}`);
          }
        }
      }
    }

    logWebhookEvent('whatsapp', 'webhook', 'executed', {
      rulesExecuted,
      errors: errors.length,
    });

    return {
      ok: true,
      status: 200,
      message: `Processed ${rulesExecuted} automation rules`,
      rulesExecuted,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err: any) {
    logWebhookEvent('whatsapp', 'webhook', 'failed', { error: err.message });
    return {
      ok: false,
      status: 500,
      message: 'Webhook processing failed',
      errors: [err.message],
    };
  }
}

/**
 * Verify WhatsApp webhook callback (challenge response)
 */
export function verifyWhatsAppWebhookChallenge(
  request: Request,
  verifyToken: string
): { valid: boolean; challenge?: string } {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return { valid: true, challenge };
  }

  return { valid: false };
}
