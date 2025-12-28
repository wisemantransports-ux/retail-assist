/**
 * Instagram Webhook Handler
 * 
 * Integrates Instagram comments and DMs with the automation executor.
 * Uses the same Graph API webhook structure as Facebook.
 * 
 * To wire with executor:
 * ```
 * import { handleInstagramWebhook } from '@/lib/webhooks/instagram-webhook';
 * 
 * export async function POST(request: Request) {
 *   const result = await handleInstagramWebhook(request);
 *   return Response.json(result);
 * }
 * ```
 */

/// <reference path="./webhooks-shim.d.ts" />

import {
  logWebhookEvent,
  verifyInstagramSignature,
  validateWorkspaceAndSubscription,
  extractWorkspaceIdFromPayload,
  extractAgentIdFromPayload,
  safeJsonParse,
} from './webhook-utils';

/**
 * Instagram webhook handler result
 */
export interface InstagramWebhookResult {
  ok: boolean;
  status: number;
  message: string;
  rulesExecuted?: number;
  errors?: string[];
}

/**
 * Handle incoming Instagram webhook
 * 
 * @param request - HTTP request with webhook payload
 * @param appSecret - Instagram App Secret (from env)
 * @param pageAccessToken - Instagram Page Access Token
 * @returns Webhook response
 */
export async function handleInstagramWebhook(
  request: Request,
  appSecret: string,
  pageAccessToken: string
): Promise<InstagramWebhookResult> {
  const errors: string[] = [];
  let rulesExecuted = 0;

  try {
    // Parse request body
    const bodyText = await request.text();
    const payload = safeJsonParse(bodyText);

    if (!payload) {
      logWebhookEvent('instagram', 'webhook', 'failed', { error: 'Invalid JSON' });
      return {
        ok: false,
        status: 400,
        message: 'Invalid JSON payload',
        errors: ['Failed to parse JSON'],
      };
    }

    logWebhookEvent('instagram', 'webhook', 'received', { entryCount: payload.entry?.length });

    // Verify signature
    const signature = request.headers.get('X-Hub-Signature-256');
    const verification = verifyInstagramSignature(bodyText, signature, appSecret);

    if (!verification.valid) {
      logWebhookEvent('instagram', 'webhook', 'failed', { error: verification.error });
      return {
        ok: false,
        status: 403,
        message: 'Signature verification failed',
        errors: [verification.error || 'Invalid signature'],
      };
    }

    logWebhookEvent('instagram', 'webhook', 'verified');

    // Extract and process webhook events
    if (!payload.entry || !Array.isArray(payload.entry)) {
      return {
        ok: true,
        status: 200,
        message: 'No entries to process',
      };
    }

    const env = (globalThis as any).env || {};
    const supabase = (globalThis as any).createServerSupabaseClient?.() || null;
    const executeAutomationRulesForComment = (globalThis as any).executeAutomationRulesForComment;
    const executeAutomationRulesForMessage = (globalThis as any).executeAutomationRulesForMessage;

    // Process each entry
    for (const entry of payload.entry) {
      const workspaceId = extractWorkspaceIdFromPayload(payload, 'instagram');
      let agentId = extractAgentIdFromPayload(payload, 'instagram');

      if (!workspaceId) {
        errors.push('Could not extract workspace ID from payload');
        continue;
      }

      // Validate workspace and subscription
      if (supabase) {
        const validation = await validateWorkspaceAndSubscription(workspaceId, supabase);
        if (!validation.valid) {
          logWebhookEvent('instagram', 'webhook', 'failed', {
            workspace: workspaceId,
            error: validation.error,
          });
          errors.push(`Workspace validation failed: ${validation.error}`);
          continue;
        }
      }

      // Process comments on media
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          try {
            // Instagram sends comments under "comments" field
            if (change.field === 'comments') {
              const value = change.value;

              if (!agentId && supabase) {
                const { data: agent } = await supabase
                  .from('agents')
                  .select('id')
                  .eq('workspace_id', workspaceId)
                  .eq('platform', 'instagram')
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
                commentId: value.id || `ig_comment_${Date.now()}`,
                commentText: value.text || '',
                authorId: value.from?.id,
                authorName: value.from?.name,
                platform: 'instagram' as const,
                postId: value.media_id || entry.id,
                pageAccessToken,
              };

              logWebhookEvent('instagram', 'comment', 'parsed', {
                workspace: workspaceId,
                agent: agentId,
                commentId: input.commentId,
              });

              if (env.useMockMode || !executeAutomationRulesForComment) {
                logWebhookEvent('instagram', 'comment', 'executed', { mock: true });
                rulesExecuted++;
              } else {
                try {
                  const result = await executeAutomationRulesForComment(input);
                  if (result?.ok) {
                    rulesExecuted++;
                    logWebhookEvent('instagram', 'comment', 'executed', {
                      ruleMatched: result.ruleMatched,
                      actionExecuted: result.actionExecuted,
                    });
                  }
                } catch (execErr: any) {
                  errors.push(`Executor error: ${execErr.message}`);
                }
              }
            }

            // Instagram direct messages
            if (change.field === 'messages') {
              const value = change.value;

              if (!agentId && supabase) {
                const { data: agent } = await supabase
                  .from('agents')
                  .select('id')
                  .eq('workspace_id', workspaceId)
                  .eq('platform', 'instagram')
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
                commentId: value.id || `ig_dm_${Date.now()}`,
                commentText: value.text || '',
                authorId: value.from?.id,
                authorName: value.from?.username,
                platform: 'instagram' as const,
                messageType: 'dm' as const,
                pageAccessToken,
              };

              logWebhookEvent('instagram', 'message', 'parsed', {
                workspace: workspaceId,
                agent: agentId,
              });

              if (env.useMockMode || !executeAutomationRulesForMessage) {
                logWebhookEvent('instagram', 'message', 'executed', { mock: true });
                rulesExecuted++;
              } else {
                try {
                  const result = await executeAutomationRulesForMessage(input);
                  if (result?.ok) {
                    rulesExecuted++;
                    logWebhookEvent('instagram', 'message', 'executed', {
                      ruleMatched: result.ruleMatched,
                    });
                  }
                } catch (execErr: any) {
                  errors.push(`Executor error: ${execErr.message}`);
                }
              }
            }
          } catch (changeErr: any) {
            errors.push(`Change processing error: ${changeErr.message}`);
          }
        }
      }
    }

    logWebhookEvent('instagram', 'webhook', 'executed', {
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
    logWebhookEvent('instagram', 'webhook', 'failed', { error: err.message });
    return {
      ok: false,
      status: 500,
      message: 'Webhook processing failed',
      errors: [err.message],
    };
  }
}

/**
 * Verify Instagram webhook callback (challenge response)
 */
export function verifyInstagramWebhookChallenge(
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
