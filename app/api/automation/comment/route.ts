/**
 * POST /api/automation/comment
 * Process incoming comment events and trigger automation rules
 *
 * Receives:
 * - postId: ID of the post being commented on
 * - commentId: ID of the comment
 * - commentText: The comment content
 * - authorId: ID of comment author (on platform)
 * - authorName: Name of comment author
 * - userId: Internal user ID (if available)
 * - workspaceId: Workspace to process for
 * - platform: 'facebook' | 'instagram'
 * - pageAccessToken: (optional) Meta API access token
 *
 * Returns:
 * - { status: 'ok', replied: boolean, sentDM: boolean }
 */

import { NextResponse } from 'next/server';
import {
  getAutomationRules,
  getAgentById,
  hasAlreadyReplied,
  logAutomationAction,
} from '@/lib/supabase/queries';
import {
  detectKeyword,
  buildAIResponse,
  sendCommentReply,
  sendDM,
  shouldSkipRule,
  applyDelay,
} from '@/lib/automation';
import { env } from '@/lib/env';

interface CommentAutomationRequest {
  postId: string;
  commentId: string;
  commentText: string;
  authorId?: string;
  authorName?: string;
  userId?: string;
  workspaceId: string;
  platform: 'facebook' | 'instagram';
  pageAccessToken?: string;
}

interface CommentAutomationResponse {
  status: 'ok' | 'error';
  replied: boolean;
  sentDM: boolean;
  message?: string;
  error?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: CommentAutomationRequest = await request.json();

    // Validate required fields
    const requiredFields = ['postId', 'commentId', 'commentText', 'workspaceId', 'platform'];
    const missing = requiredFields.filter(field => !body[field as keyof CommentAutomationRequest]);

    if (missing.length > 0) {
      return NextResponse.json(
        {
          status: 'error',
          replied: false,
          sentDM: false,
          error: `Missing required fields: ${missing.join(', ')}`,
        },
        { status: 400 }
      );
    }

    console.log('[API] Processing comment automation request:', {
      commentId: body.commentId,
      workspaceId: body.workspaceId,
      platform: body.platform,
    });

    // Step 1: Check if already replied to this comment
    const alreadyReplied = await hasAlreadyReplied(body.commentId);
    if (alreadyReplied) {
      console.log('[API] Comment already processed, skipping:', body.commentId);
      return NextResponse.json({
        status: 'ok',
        replied: false,
        sentDM: false,
        message: 'Comment already processed',
      });
    }

    // Step 2: Get automation rules for this workspace
    const rules = await getAutomationRules(body.workspaceId, undefined, true);

    if (!rules || rules.length === 0) {
      console.log('[API] No automation rules found for workspace:', body.workspaceId);
      return NextResponse.json({
        status: 'ok',
        replied: false,
        sentDM: false,
        message: 'No automation rules configured',
      });
    }

    let replied = false;
    let sentDM = false;

    // Step 3: Process each enabled rule
    for (const rule of rules) {
      // Check if this rule should match this comment
      const keywordMatched = detectKeyword(body.commentText, rule.trigger_words);
      const platformMatched = !rule.trigger_platforms || rule.trigger_platforms.includes(body.platform);

      if (!keywordMatched || !platformMatched) {
        console.log('[API] Rule does not match:', {
          ruleId: rule.id,
          keywordMatched,
          platformMatched,
        });
        continue;
      }

      console.log('[API] Rule matched:', rule.id);

      // Check skip conditions
      if (shouldSkipRule(rule, false)) {
        console.log('[API] Rule skipped due to skip conditions:', rule.id);
        continue;
      }

      // Get the agent for this rule
      const agent = await getAgentById(rule.agent_id);
      if (!agent) {
        console.error('[API] Agent not found for rule:', rule.id);
        continue;
      }

      // Apply delay if configured
      if (rule.delay_seconds && rule.delay_seconds > 0) {
        console.log('[API] Applying delay:', rule.delay_seconds, 'seconds');
        await applyDelay(rule.delay_seconds);
      }

      // Step 4: Send public reply if configured
      if (rule.send_public_reply && rule.public_reply_template) {
        try {
          console.log('[API] Generating public reply from template');
          const replyText = await buildAIResponse(
            agent.id,
            body.commentText,
            agent,
            rule.public_reply_template
          );

          const replyResult = await sendCommentReply(
            body.platform,
            body.postId,
            body.commentId,
            replyText,
            body.pageAccessToken
          );

          if (replyResult.success) {
            replied = true;
            console.log('[API] Public reply sent:', replyResult.replyId);

            // Log the action
            await logAutomationAction({
              workspace_id: body.workspaceId,
              agent_id: agent.id,
              comment_id: body.commentId,
              action: 'replied',
              platform: body.platform,
              trigger_rule_id: rule.id,
              response_text: replyText,
              metadata: {
                postId: body.postId,
                replyId: replyResult.replyId,
              },
            });
          }
        } catch (err: any) {
          console.error('[API] Error sending public reply:', err.message);
        }
      }

      // Step 5: Send DM if configured
      if (rule.send_private_reply && rule.private_reply_template && body.authorId) {
        try {
          console.log('[API] Generating DM from template');
          const dmText = await buildAIResponse(
            agent.id,
            body.commentText,
            agent,
            rule.private_reply_template
          );

          const dmResult = await sendDM(body.platform, body.authorId, dmText, body.pageAccessToken);

          if (dmResult.success) {
            sentDM = true;
            console.log('[API] DM sent:', dmResult.messageId);

            // Log the action
            await logAutomationAction({
              workspace_id: body.workspaceId,
              agent_id: agent.id,
              comment_id: body.commentId,
              action: 'sent_dm',
              platform: body.platform,
              trigger_rule_id: rule.id,
              response_text: dmText,
              metadata: {
                authorId: body.authorId,
                messageId: dmResult.messageId,
              },
            });
          }
        } catch (err: any) {
          console.error('[API] Error sending DM:', err.message);
        }
      }

      // If we successfully processed a rule, don't continue to next rules
      if (replied || sentDM) {
        break;
      }
    }

    // Return success response
    return NextResponse.json({
      status: 'ok',
      replied,
      sentDM,
      message: replied || sentDM ? 'Automation completed successfully' : 'No automation action taken',
    });
  } catch (error: any) {
    console.error('[API] Error in comment automation:', error);
    return NextResponse.json(
      {
        status: 'error',
        replied: false,
        sentDM: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automation/comment
 * Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'comment-automation',
    mode: env.useMockMode ? 'mock' : 'production',
  });
}
