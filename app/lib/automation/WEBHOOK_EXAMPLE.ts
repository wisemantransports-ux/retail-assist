/**
 * Example: Facebook Webhook Handler using Automation Rules Executor
 * 
 * This shows how to integrate executeAutomationRulesForComment into
 * a webhook handler that receives comments from Facebook/Instagram.
 * 
 * This is a reference implementation. Adapt as needed for your webhook.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeAutomationRulesForComment } from '@/lib/automation/executeAutomationRules';

/**
 * Verify webhook authenticity
 * (Would validate Facebook signature in production)
 */
function verifyWebhookSignature(req: NextRequest): boolean {
  // TODO: Validate X-Hub-Signature header
  return true;
}

/**
 * Extract comment data from Facebook webhook payload
 */
function extractCommentData(event: any) {
  return {
    commentId: event.comment.id,
    postId: event.comment.post_id,
    pageId: event.comment.page_id,
    content: event.comment.message,
    authorId: event.comment.from?.id,
    authorName: event.comment.from?.name,
    createdTime: event.comment.created_time,
    permalink: event.comment.permalink_url,
  };
}

/**
 * GET: Webhook verification
 * Facebook sends this to verify the webhook URL
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Facebook Webhook] Subscription verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST: Handle incoming webhook events
 * Called when new comments are created on the page
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(request)) {
      console.warn('[Facebook Webhook] Invalid signature');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();

    // Handle batch of events
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        const pageId = entry.id;
        const timestamp = entry.time;

        // Handle each messaging event
        if (entry.messaging && Array.isArray(entry.messaging)) {
          for (const event of entry.messaging) {
            if (event.message) {
              await handleCommentEvent(pageId, event);
            }
          }
        }

        // Handle each comment event
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'feed' && change.value.comment_id) {
              await handleFeedCommentEvent(pageId, change.value);
            }
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return new NextResponse(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Facebook Webhook] Error processing event:', error);
    return new NextResponse(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}

/**
 * Handle a single comment event from webhook
 * 
 * Note: This is a simplified example. In production, you would:
 * - Look up which workspace this page belongs to
 * - Find the agent configured for this page
 * - Fetch full comment data from Facebook API if needed
 */
async function handleCommentEvent(pageId: string, event: any) {
  try {
    console.log(`[Facebook Webhook] Processing comment event on page ${pageId}`);

    // Extract comment data from event
    const comment = event.message || event.postback;
    if (!comment) return;

    // TODO: Query database to find workspace and agent for this pageId
    const workspaceId = 'ws_' + pageId; // Simplified - should be DB lookup
    const agentId = 'agent_001'; // Simplified - should be DB lookup

    // Check if workspace and agent exist
    if (!workspaceId || !agentId) {
      console.log(`[Facebook Webhook] No workspace/agent configured for page ${pageId}`);
      return;
    }

    // Build input for executor
    const automationInput = {
      workspaceId,
      agentId,
      commentId: comment.mid || comment.timestamp?.toString(),
      commentText: comment.text || '',
      authorId: event.sender?.id,
      authorName: event.sender?.name,
      platform: 'facebook' as const,
    };

    // Execute automation rules
    console.log(`[Facebook Webhook] Executing automation rules for ${agentId}`);
    const result = await executeAutomationRulesForComment(automationInput);

    if (result.ok) {
      if (result.actionExecuted) {
        console.log(`[Facebook Webhook] ✓ Automation executed (DM sent: ${result.dmSent})`);
      } else if (result.ruleMatched) {
        console.log(`[Facebook Webhook] ✓ Rule matched but action not executed`);
      } else {
        console.log(`[Facebook Webhook] ✓ No matching rules`);
      }
    } else {
      console.error(`[Facebook Webhook] ✗ Execution failed: ${result.error}`);
    }
  } catch (error: any) {
    console.error('[Facebook Webhook] Error handling comment event:', error.message);
  }
}

/**
 * Handle a feed comment event from webhook
 * This is for comments on posts (page feed)
 */
async function handleFeedCommentEvent(pageId: string, eventData: any) {
  try {
    console.log(`[Facebook Webhook] Processing feed comment on page ${pageId}`);

    const commentData = extractCommentData({ comment: eventData });

    // TODO: Query database to find workspace and agent for this pageId
    const workspaceId = 'ws_' + pageId;
    const agentId = 'agent_001';

    if (!workspaceId || !agentId) {
      console.log(`[Facebook Webhook] No workspace/agent configured for page ${pageId}`);
      return;
    }

    const automationInput = {
      workspaceId,
      agentId,
      commentId: commentData.commentId,
      commentText: commentData.content,
      authorId: commentData.authorId,
      authorName: commentData.authorName,
      platform: 'facebook' as const,
    };

    console.log(`[Facebook Webhook] Executing automation rules for comment ${commentData.commentId}`);
    const result = await executeAutomationRulesForComment(automationInput);

    if (result.ok && result.actionExecuted) {
      console.log(`[Facebook Webhook] ✓ DM sent for comment ${commentData.commentId}`);
    } else if (!result.ruleMatched) {
      console.log(`[Facebook Webhook] No matching automation rules for comment ${commentData.commentId}`);
    }
  } catch (error: any) {
    console.error('[Facebook Webhook] Error handling feed comment:', error.message);
  }
}

/**
 * INTEGRATION CHECKLIST
 * 
 * To use this webhook handler:
 * 
 * 1. Deploy this file to /app/api/webhooks/facebook/route.ts
 * 
 * 2. Configure Facebook App:
 *    - Set Webhook URL to: https://yourdomain.com/api/webhooks/facebook
 *    - Set Verify Token to: FACEBOOK_WEBHOOK_VERIFY_TOKEN
 *    - Subscribe to: messages, feed (for comments)
 * 
 * 3. Set environment variables:
 *    FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_random_token_here
 *    FACEBOOK_PAGE_ACCESS_TOKEN=your_page_token (for API calls)
 * 
 * 4. Implement DB lookup for workspace/agent by pageId
 *    (Currently hardcoded - needs real implementation)
 * 
 * 5. Add proper error handling and retries
 * 
 * 6. Test with webhook simulator or real comment
 */
