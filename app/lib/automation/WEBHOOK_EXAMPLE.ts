/**
 * Example: Facebook Webhook Handler using Automation Rules Executor
 *
 * Reference implementation for handling Facebook / Instagram comment events
 * and passing them into the automation executor.
 *
 * This webhook is intentionally lightweight:
 * - It validates the request
 * - Normalizes incoming data
 * - Delegates all business logic to the executor
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeAutomationRulesForComment } from '@/lib/automation/executeAutomationRules';

/**
 * Verify webhook authenticity
 * (Facebook signature verification should be implemented in production)
 */
function verifyWebhookSignature(_req: NextRequest): boolean {
  // TODO: Validate X-Hub-Signature-256 header
  return true;
}

/**
 * Extract normalized comment data from feed webhook payload
 */
function extractCommentData(event: any) {
  return {
    commentId: event.comment_id,
    postId: event.post_id,
    pageId: event.page_id,
    content: event.message,
    authorId: event.from?.id,
    authorName: event.from?.name,
    createdTime: event.created_time,
    permalink: event.permalink_url,
  };
}

/**
 * GET — Webhook verification endpoint
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Facebook Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST — Handle incoming webhook events
 */
export async function POST(request: NextRequest) {
  try {
    if (!verifyWebhookSignature(request)) {
      console.warn('[Facebook Webhook] Invalid signature');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();

    if (Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        const pageId = entry.id;

        // Feed comments (page posts)
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'feed' && change.value?.comment_id) {
              await handleFeedCommentEvent(pageId, change.value);
            }
          }
        }

        // Messaging comments (Messenger / IG comments)
        if (Array.isArray(entry.messaging)) {
          for (const event of entry.messaging) {
            await handleMessagingCommentEvent(pageId, event);
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[Facebook Webhook] Fatal error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle Messenger-style comment events
 */
async function handleMessagingCommentEvent(pageId: string, event: any) {
  try {
    if (!event.message?.text) return;

    console.log(`[Facebook Webhook] Messaging comment received on page ${pageId}`);

    // TODO: Replace with real DB lookup
    const workspaceId = `ws_${pageId}`;
    const agentId = 'agent_001';

    const automationInput = {
      workspaceId,
      agentId,
      commentId: event.message.mid ?? String(Date.now()),
      commentText: event.message.text,
      authorId: event.sender?.id,
      authorName: undefined,
      platform: 'facebook' as const,
    };

    const result = await executeAutomationRulesForComment(automationInput);

    if (result.ok) {
      console.log('[Facebook Webhook] Automation processed successfully');
    }
  } catch (error: any) {
    console.error('[Facebook Webhook] Error handling messaging comment:', error.message);
  }
}

/**
 * Handle feed (page post) comment events
 */
async function handleFeedCommentEvent(pageId: string, eventData: any) {
  try {
    console.log(`[Facebook Webhook] Feed comment received on page ${pageId}`);

    const comment = extractCommentData(eventData);

    // TODO: Replace with real DB lookup
    const workspaceId = `ws_${pageId}`;
    const agentId = 'agent_001';

    const automationInput = {
      workspaceId,
      agentId,
      commentId: comment.commentId,
      commentText: comment.content,
      authorId: comment.authorId,
      authorName: comment.authorName,
      platform: 'facebook' as const,
    };

    const result = await executeAutomationRulesForComment(automationInput);

    if (result.ok) {
      console.log('[Facebook Webhook] Automation processed successfully');
    }
  } catch (error: any) {
    console.error('[Facebook Webhook] Error handling feed comment:', error.message);
  }
}

/**
 * NOTES
 *
 * - This webhook intentionally does NOT inspect rule execution details.
 * - The automation executor is the source of truth.
 * - Usage limits, safety checks, audit logging, and permissions
 *   are enforced inside the executor.
 *
 * This design matches production webhook standards (Stripe, Meta, Shopify).
 */
