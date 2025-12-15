/**
 * Comment Automation Handler
 * Processes detected comments and executes automation rules
 */

import { createAdminSupabaseClient, createMockAdminSupabaseClient } from '@/lib/supabase/server';
import { 
  saveComment, 
  markCommentProcessed, 
  createDirectMessage, 
  createAuditLog,
  getAgentById,
} from '@/lib/supabase/queries';
import { generateAgentResponse } from '@/lib/openai/server';
import { generateMockResponse } from '@/lib/openai/mock';
import { env } from '@/lib/env';
import type { Comment, AutomationRule, Agent } from '@/lib/types/database';

export interface CommentAutomationInput {
  workspaceId: string;
  agentId: string;
  comment: {
    pageId?: string;
    commentId?: string;
    postId?: string;
    content: string;
    authorId?: string;
    authorName?: string;
    createdTime?: string;
    permalink?: string;
  };
  rule: AutomationRule;
  pageAccessToken?: string;
  agent?: Agent;
}

export interface CommentAutomationResult {
  ok: boolean;
  processed: boolean;
  commentId?: string;
  publicReplyId?: string;
  dmSent?: boolean;
  error?: string;
  details?: string;
}

/**
 * Main automation handler
 * Orchestrates comment storage, rule checking, reply generation, and logging
 */
export async function runCommentAutomation(
  input: CommentAutomationInput
): Promise<CommentAutomationResult> {
  const {
    workspaceId,
    agentId,
    comment,
    rule,
    pageAccessToken,
    agent: providedAgent,
  } = input;

  try {
    const useMock = env.useMockMode;
    const supabase = useMock ? await createMockAdminSupabaseClient() : await createAdminSupabaseClient();

    // Step 1: Store the comment in database
    console.log(`[Comment Automation] Processing comment: ${comment.commentId}`);

    const storedComment = await saveComment(agentId, {
      platform: 'facebook',
      author_email: undefined,
      author_name: comment.authorName || 'Unknown',
      content: comment.content,
      platform_comment_id: comment.commentId,
    });

    if (!storedComment) {
      return {
        ok: false,
        processed: false,
        error: 'Failed to store comment',
      };
    }

    const commentId = storedComment.id;
    console.log(`[Comment Automation] Comment stored: ${commentId}`);

    // Step 2: Check if rule exists and is enabled
    if (!rule?.id || !rule.enabled) {
      console.log(`[Comment Automation] No automation rule enabled for workspace ${workspaceId}`);
      return {
        ok: true,
        processed: false,
        commentId,
        details: 'No automation rule enabled',
      };
    }

    // Step 3: Get agent if not provided
    let automationAgent = providedAgent;
    if (!automationAgent) {
      automationAgent = await getAgentById(agentId);
      if (!automationAgent) {
        await createAuditLog(
          workspaceId,
          undefined,
          'processed',
          'comment',
          commentId,
          { error: 'Agent not found' }
        );
        return {
          ok: false,
          processed: false,
          commentId,
          error: 'Agent not found',
        };
      }
    }

    let publicReplyId: string | undefined;
    let dmSent = false;

    // Step 4: Generate and send public reply if configured
    if (rule.send_public_reply && rule.public_reply_template) {
      console.log(`[Comment Automation] Generating public reply for comment ${commentId}`);
      
      try {
        const publicReply = await generatePublicReply(
          comment.content,
          rule.public_reply_template,
          automationAgent
        );

        console.log(`[Comment Automation] Public reply generated: "${publicReply}"`);
        
        // In production, this would send to Facebook API
        // For now, we simulate it
        publicReplyId = `reply_${Date.now()}`;
        console.log(`[Comment Automation] Public reply would be sent to Facebook: ${publicReplyId}`);
      } catch (err: any) {
        console.error('[Comment Automation] Failed to generate public reply:', err.message);
        await createAuditLog(
          workspaceId,
          undefined,
          'processed',
          'comment',
          commentId,
          { publicReplyError: err.message }
        );
      }
    }

    // Step 5: Generate and send DM reply if configured
    if (rule.send_private_reply && rule.private_reply_template && comment.authorId) {
      console.log(`[Comment Automation] Generating DM reply for author ${comment.authorId}`);
      
      try {
        const dmReply = await generateDmReply(
          comment.content,
          rule.private_reply_template,
          automationAgent
        );

        console.log(`[Comment Automation] DM reply generated: "${dmReply}"`);

        // Store DM in database
        const dmResult = await createDirectMessage(workspaceId, {
          agent_id: agentId,
          recipient_id: comment.authorId,
          recipient_name: comment.authorName,
          content: dmReply,
          platform: 'facebook_messenger',
        });

        if (dmResult) {
          dmSent = true;
          console.log(`[Comment Automation] DM stored: ${dmResult.id}`);
        }
      } catch (err: any) {
        console.error('[Comment Automation] Failed to generate DM reply:', err.message);
        await createAuditLog(
          workspaceId,
          undefined,
          'processed',
          'comment',
          commentId,
          { dmError: err.message }
        );
      }
    }

    // Step 6: Mark comment as processed
    const botReplyContent = publicReplyId || (dmSent ? 'DM sent' : 'No reply');
    const processedComment = await markCommentProcessed(commentId, botReplyContent, publicReplyId);

    if (!processedComment) {
      console.error('[Comment Automation] Failed to mark comment as processed');
    }

    // Step 7: Log automation event in audit log
    await createAuditLog(
      workspaceId,
      undefined,
      'processed',
      'comment',
      commentId,
      {
        publicReplyId,
        dmSent,
        ruleId: rule.id,
      }
    );

    console.log(`[Comment Automation] Automation complete for comment ${commentId}`);

    return {
      ok: true,
      processed: true,
      commentId,
      publicReplyId,
      dmSent,
    };
  } catch (err: any) {
    console.error('[Comment Automation] Unexpected error:', err);
    return {
      ok: false,
      processed: false,
      error: err.message || 'Unknown error in comment automation',
    };
  }
}

/**
 * Generate public reply using template and AI
 */
async function generatePublicReply(
  commentContent: string,
  template: string,
  agent: Agent
): Promise<string> {
  // If template has placeholders, use AI to generate personalized reply
  if (template.includes('{') && template.includes('}')) {
    try {
      const systemPrompt = `${agent.system_prompt}\n\nYou are generating a public comment reply. Keep it brief and professional.`;
      const userMessage = `The customer commented: "${commentContent}"\n\nUse this template and personalize it: "${template}"`;

      if (env.useMockMode) {
        return await generateMockResponse(systemPrompt, userMessage);
      } else {
        return await generateAgentResponse(systemPrompt, userMessage, {
          model: agent.model,
          temperature: agent.temperature,
          max_tokens: agent.max_tokens,
        });
      }
    } catch (err) {
      console.error('Failed to generate AI-personalized reply, falling back to template');
      return template.replace(/\{.*?\}/g, 'Thank you for your feedback!');
    }
  }

  // Otherwise, use template as-is (already customized)
  return template;
}

/**
 * Generate DM reply using AI agent
 */
async function generateDmReply(
  commentContent: string,
  template: string,
  agent: Agent
): Promise<string> {
  try {
    const systemPrompt = agent.system_prompt || 'You are a helpful customer service representative.';
    const userMessage = `Customer comment: "${commentContent}"\n\nReply template/instructions: "${template}"\n\nGenerate a helpful DM response.`;

    if (env.useMockMode) {
      return await generateMockResponse(systemPrompt, userMessage);
    } else {
      return await generateAgentResponse(systemPrompt, userMessage, {
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
      });
    }
  } catch (err: any) {
    console.error('Failed to generate DM reply:', err.message);
    return template || 'Thank you for reaching out! We will get back to you shortly.';
  }
}

