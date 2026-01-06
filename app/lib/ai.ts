/**
 * AI Response Generation using OpenAI with usage tracking
 */

import { generateAgentResponseWithTracking } from './openai/server';

interface GenerateResponseOptions {
  workspaceId: string;
  agentId?: string;
  sessionId?: string;
  systemPrompt: string;
  userMessage: string;
  businessName?: string;
  context?: string;
  maxTokens?: number;
  platform?: string;
}

/**
 * Generate an AI response using OpenAI with usage tracking
 */
export async function generateAIResponse(options: GenerateResponseOptions): Promise<string | null> {
  const {
    workspaceId,
    agentId,
    sessionId,
    systemPrompt,
    userMessage,
    businessName,
    context,
    maxTokens = 150,
    platform
  } = options;

  try {
    const fullSystemPrompt = `${systemPrompt}

${businessName ? `You are responding on behalf of ${businessName}.` : ''}
${context ? `Context: ${context}` : ''}

Keep responses concise, friendly, and professional. Do not use markdown formatting.`;

    const result = await generateAgentResponseWithTracking(
      workspaceId,
      agentId || null,
      sessionId || null,
      fullSystemPrompt,
      userMessage,
      platform || null,
      {
        model: 'gpt-3.5-turbo', // Using gpt-3.5-turbo for backwards compatibility
        max_tokens: maxTokens,
        temperature: 0.7
      }
    );

    if (result.content) {
      console.log('[AI] Generated response:', result.content.substring(0, 50) + '...');
      return result.content;
    }

    return null;
  } catch (error: any) {
    console.error('[AI] Error generating response:', error.message);
    return null;
  }
}

/**
 * Generate a comment reply with usage tracking
 */
export async function generateCommentReply(
  workspaceId: string,
  agentId: string | undefined,
  commentText: string,
  systemPrompt: string,
  businessName?: string,
  platform: string = 'facebook'
): Promise<string | null> {
  return generateAIResponse({
    workspaceId,
    agentId,
    systemPrompt: systemPrompt || 'You are a helpful customer service agent. Reply to customer comments professionally.',
    userMessage: `A customer commented: "${commentText}"\n\nPlease write a friendly reply.`,
    businessName,
    context: 'This is a reply to a social media comment.',
    maxTokens: 100,
    platform
  });
}

/**
 * Generate a DM reply with usage tracking
 */
export async function generateDMReply(
  workspaceId: string,
  agentId: string | undefined,
  messageText: string,
  systemPrompt: string,
  businessName?: string,
  platform: string = 'facebook'
): Promise<string | null> {
  return generateAIResponse({
    workspaceId,
    agentId,
    systemPrompt: systemPrompt || 'You are a helpful customer service agent. Reply to customer messages professionally.',
    userMessage: messageText,
    businessName,
    context: 'This is a direct message conversation.',
    maxTokens: 150,
    platform
  });
}
