/**
 * Comment Automation Helper Functions
 * Core logic for detecting keywords, building responses, and sending replies
 */

import { generateAgentResponse } from './openai/server';
import { generateMockResponse } from './openai/mock';
import { env } from './env';
import type { Agent, AutomationRule } from './types/database';

/**
 * Detect if comment text contains trigger keywords from rule
 */
export function detectKeyword(commentText: string, triggerWords?: string[]): boolean {
  if (!triggerWords || triggerWords.length === 0) {
    return false;
  }

  const lowerText = commentText.toLowerCase();
  return triggerWords.some(word => lowerText.includes(word.toLowerCase()));
}

/**
 * Build AI-generated response using agent
 * Uses the agent's system prompt and settings to generate contextual replies
 */
export async function buildAIResponse(
  agentId: string,
  commentText: string,
  agent: Agent,
  template?: string
): Promise<string> {
  try {
    const systemPrompt = agent.system_prompt || 'You are a helpful customer service assistant.';

    // If template provided, use it as context for AI to personalize
    let userMessage = commentText;
    if (template) {
      userMessage = `Customer comment: "${commentText}"\n\nUse this template as guidance: "${template}"`;
    } else {
      userMessage = `Reply to this customer comment professionally and helpfully: "${commentText}"`;
    }

    if (env.useMockMode) {
      return await generateMockResponse(systemPrompt, userMessage);
    }

    return await generateAgentResponse(systemPrompt, userMessage, {
      model: agent.model,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
    });
  } catch (err: any) {
    console.error('[Automation] Failed to build AI response:', err.message);
    // Fallback response
    return template || 'Thank you for your comment! We appreciate your feedback.';
  }
}

/**
 * Send a public reply to a comment (placeholder for Meta API integration)
 * In production, this will call the Facebook Graph API
 *
 * @param platform - 'facebook' | 'instagram'
 * @param postId - ID of the post being commented on
 * @param commentId - ID of the comment to reply to
 * @param text - Reply text
 * @param accessToken - Meta API access token
 */
export async function sendCommentReply(
  platform: 'facebook' | 'instagram',
  postId: string,
  commentId: string,
  text: string,
  accessToken?: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    console.log(`[Automation] Placeholder: Would send ${platform} comment reply to ${commentId}`);
    console.log(`[Automation] Reply text: "${text}"`);

    // In production, this would be:
    // const response = await fetch(`https://graph.instagram.com/v18.0/${commentId}/replies`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     message: text,
    //     access_token: accessToken,
    //   }),
    // });

    // For now, simulate success
    const simulatedReplyId = `reply_${Date.now()}`;
    console.log(`[Automation] Simulated reply ID: ${simulatedReplyId}`);

    return {
      success: true,
      replyId: simulatedReplyId,
    };
  } catch (err: any) {
    console.error('[Automation] Error sending comment reply:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Send a direct message to user (placeholder for Meta API integration)
 * In production, this will send via Facebook Messenger or Instagram DM
 *
 * @param platform - 'facebook' | 'instagram'
 * @param userId - User/recipient ID on the platform
 * @param text - Message text
 * @param accessToken - Meta API access token
 */
export async function sendDM(
  platform: 'facebook' | 'instagram',
  userId: string,
  text: string,
  accessToken?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`[Automation] Placeholder: Would send ${platform} DM to user ${userId}`);
    console.log(`[Automation] Message text: "${text}"`);

    // In production, this would be:
    // const response = await fetch(`https://graph.instagram.com/v18.0/me/messages`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     recipient: { id: userId },
    //     message: { text },
    //     access_token: accessToken,
    //   }),
    // });

    // For now, simulate success
    const simulatedMessageId = `dm_${Date.now()}`;
    console.log(`[Automation] Simulated message ID: ${simulatedMessageId}`);

    return {
      success: true,
      messageId: simulatedMessageId,
    };
  } catch (err: any) {
    console.error('[Automation] Error sending DM:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Check if a rule should be skipped for this comment
 * Based on auto_skip_replies and other conditions
 */
export function shouldSkipRule(rule: AutomationRule, isReplyToReply?: boolean): boolean {
  // Skip if rule has auto_skip_replies enabled and this is a reply to a reply
  if (rule.auto_skip_replies && isReplyToReply) {
    return true;
  }

  return false;
}

/**
 * Apply delay before sending reply (for more natural feel)
 */
export async function applyDelay(seconds?: number): Promise<void> {
  if (!seconds || seconds <= 0) {
    return;
  }

  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
