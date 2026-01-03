/**
 * Facebook Webhook Handler
 * 
 * Integrates Facebook Messenger and Comments with the automation executor.
 * Handles:
 * - Comment creation on posts
 * - Direct messages
 * - Message echoes and reads
 * 
 * To wire with executor:
 * ```
 * import { handleFacebookWebhook } from '@/lib/webhooks/facebook-webhook';
 * 
 * export async function POST(request: Request) {
 *   const result = await handleFacebookWebhook(request);
 *   return Response.json(result);
 * }
 * ```
 */

/// <reference path="./webhooks-shim.d.ts" />

import {
  logWebhookEvent,
  verifyFacebookSignature,
  validateWorkspaceAndSubscription,
  extractWorkspaceIdFromPayload,
  extractAgentIdFromPayload,
  safeJsonParse,
  NormalizedWebhookPayload,
} from './webhook-utils';

/**
 * Facebook webhook handler result
 */
export interface FacebookWebhookResult {
  ok: boolean;
  status: number;
  message: string;
  rulesExecuted?: number;
  errors?: string[];
}

/**
 * Handle incoming Facebook webhook
 * 
 * @param request - HTTP request with webhook payload
 * @param appSecret - Facebook App Secret (from env)
 * @param pageAccessToken - Facebook Page Access Token
 * @returns Webhook response
 */
export async function handleFacebookWebhook(
  request: Request,
  appSecret: string,
  pageAccessToken: string
): Promise<FacebookWebhookResult> {
  const errors: string[] = [];
  let rulesExecuted = 0;

  try {
    // Parse request body
    const bodyText = await request.text();
    const payload = safeJsonParse(bodyText);

    if (!payload) {
      logWebhookEvent('facebook', 'webhook', 'failed', { error: 'Invalid JSON' });
      return {
        ok: false,
        status: 400,
        message: 'Invalid JSON payload',
        errors: ['Failed to parse JSON'],
      };
    }

    logWebhookEvent('facebook', 'webhook', 'received', { entryCount: payload.entry?.length });

    // Verify signature
    const signature = request.headers.get('X-Hub-Signature-256');
    const verification = verifyFacebookSignature(bodyText, signature, appSecret);

    if (!verification.valid) {
      logWebhookEvent('facebook', 'webhook', 'failed', { error: verification.error });
      return {
        ok: false,
        status: 403,
        message: 'Signature verification failed',
        errors: [verification.error || 'Invalid signature'],
      };
    }

    logWebhookEvent('facebook', 'webhook', 'verified');

    // Extract and process webhook events
    if (!payload.entry || !Array.isArray(payload.entry)) {
      return {
        ok: true,
        status: 200,
        message: 'No entries to process',
      };
    }

    // Track execution
    const env = (globalThis as any).env || {};
    const supabase = (globalThis as any).createServerClient?.() || null;
    const executeAutomationRulesForComment = (globalThis as any).executeAutomationRulesForComment;
    const executeAutomationRulesForMessage = (globalThis as any).executeAutomationRulesForMessage;

    // Process each entry (page event)
    for (const entry of payload.entry) {
      // Extract workspace/agent context
      const workspaceId = extractWorkspaceIdFromPayload(payload, 'facebook');
      let agentId = extractAgentIdFromPayload(payload, 'facebook');

      if (!workspaceId) {
        errors.push('Could not extract workspace ID from payload');
        continue;
      }

      // Validate workspace and subscription
      if (supabase) {
        const validation = await validateWorkspaceAndSubscription(workspaceId, supabase);
        if (!validation.valid) {
          logWebhookEvent('facebook', 'webhook', 'failed', {
            workspace: workspaceId,
            error: validation.error,
          });
          errors.push(`Workspace validation failed: ${validation.error}`);
          continue;
        }
      }

      // Process messaging events (comments, messages)
      if (entry.messaging && Array.isArray(entry.messaging)) {
        for (const messaging of entry.messaging) {
          try {
            // Skip read receipts and echoes
            if (messaging.read || messaging.echo) {
              continue;
            }

            // Get or set default agent ID from config
            if (!agentId && supabase) {
              const { data: agent } = await supabase
                .from('agents')
                .select('id')
                .eq('workspace_id', workspaceId)
                .eq('platform', 'facebook')
                .limit(1)
                .single();
              agentId = agent?.id;
            }

            if (!agentId) {
              errors.push('Could not determine agent ID');
              continue;
            }

            // Extract message details
            const senderId = messaging.sender?.id;
            const recipientId = messaging.recipient?.id;
            const messageData = messaging.message || messaging.postback;

            if (!senderId || !messageData) {
              continue;
            }

            const messageText = messageData.text || messageData.title || '';
            const attachments = messageData.attachments || [];

            // Prepare input for executor
            const input = {
              workspaceId,
              agentId,
              commentId: messageData.mid || `msg_${Date.now()}`,
              commentText: messageText,
              authorId: senderId,
              authorName: `User ${senderId}`,
              platform: 'facebook' as const,
              postId: recipientId,
              pageAccessToken,
              messageType: 'message' as const,
            };

            logWebhookEvent('facebook', 'message', 'parsed', {
              workspace: workspaceId,
              agent: agentId,
              messageId: input.commentId,
            });

            // Execute automation rules
            if (env.useMockMode || !executeAutomationRulesForMessage) {
              logWebhookEvent('facebook', 'message', 'executed', {
                mock: true,
                workspace: workspaceId,
              });
              rulesExecuted++;
            } else {
              try {
                const result = await executeAutomationRulesForMessage(input);
                if (result?.ok) {
                  rulesExecuted++;
                  logWebhookEvent('facebook', 'message', 'executed', {
                    workspace: workspaceId,
                    ruleMatched: result.ruleMatched,
                    actionExecuted: result.actionExecuted,
                  });
                }
              } catch (execErr: any) {
                errors.push(`Executor error: ${execErr.message}`);
                logWebhookEvent('facebook', 'message', 'failed', {
                  error: execErr.message,
                });
              }
            }
          } catch (msgErr: any) {
            errors.push(`Message processing error: ${msgErr.message}`);
            logWebhookEvent('facebook', 'message', 'failed', {
              error: msgErr.message,
            });
          }
        }
      }

      // Process comment events
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.field === 'feed' && change.value?.item === 'comment') {
            try {
              const value = change.value;

              if (!agentId && supabase) {
                const { data: agent } = await supabase
                  .from('agents')
                  .select('id')
                  .eq('workspace_id', workspaceId)
                  .eq('platform', 'facebook')
                  .limit(1)
                  .single();
                agentId = agent?.id;
              }

              if (!agentId) {
                errors.push('Could not determine agent ID');
                continue;
              }

              const input = {
                workspaceId,
                agentId,
                commentId: value.comment_id || value.id,
                commentText: value.message || '',
                authorId: value.from?.id,
                authorName: value.from?.name,
                platform: 'facebook' as const,
                postId: value.post_id || value.object_id,
                pageAccessToken,
              };

              logWebhookEvent('facebook', 'comment', 'parsed', {
                workspace: workspaceId,
                agent: agentId,
                commentId: input.commentId,
              });

              if (env.useMockMode || !executeAutomationRulesForComment) {
                logWebhookEvent('facebook', 'comment', 'executed', {
                  mock: true,
                  workspace: workspaceId,
                });
                rulesExecuted++;
              } else {
                const result = await executeAutomationRulesForComment(input);
                if (result?.ok) {
                  rulesExecuted++;
                  logWebhookEvent('facebook', 'comment', 'executed', {
                    workspace: workspaceId,
                    ruleMatched: result.ruleMatched,
                    actionExecuted: result.actionExecuted,
                  });
                }
              }
            } catch (cmtErr: any) {
              errors.push(`Comment processing error: ${cmtErr.message}`);
              logWebhookEvent('facebook', 'comment', 'failed', {
                error: cmtErr.message,
              });
            }
          }
        }
      }
    }

    logWebhookEvent('facebook', 'webhook', 'executed', {
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
    logWebhookEvent('facebook', 'webhook', 'failed', { error: err.message });
    return {
      ok: false,
      status: 500,
      message: 'Webhook processing failed',
      errors: [err.message],
    };
  }
}

/**
 * Verify Facebook webhook callback (challenge response)
 * Facebook sends a GET request with ?hub.challenge during setup
 */
export function verifyFacebookWebhookChallenge(
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
