/**
 * AI Response Generation using OpenAI
 */

import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

interface GenerateResponseOptions {
  systemPrompt: string;
  userMessage: string;
  businessName?: string;
  context?: string;
  maxTokens?: number;
}

/**
 * Generate an AI response using OpenAI
 */
export async function generateAIResponse(options: GenerateResponseOptions): Promise<string | null> {
  const { systemPrompt, userMessage, businessName, context, maxTokens = 150 } = options;

  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('[AI] OPENAI_API_KEY not configured');
    return null;
  }

  try {
    const fullSystemPrompt = `${systemPrompt}

${businessName ? `You are responding on behalf of ${businessName}.` : ''}
${context ? `Context: ${context}` : ''}

Keep responses concise, friendly, and professional. Do not use markdown formatting.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    const aiResponse = response.choices[0]?.message?.content?.trim();
    
    if (aiResponse) {
      console.log('[AI] Generated response:', aiResponse.substring(0, 50) + '...');
      return aiResponse;
    }

    return null;
  } catch (error: any) {
    console.error('[AI] Error generating response:', error.message);
    return null;
  }
}

/**
 * Generate a comment reply
 */
export async function generateCommentReply(
  commentText: string,
  systemPrompt: string,
  businessName?: string
): Promise<string | null> {
  return generateAIResponse({
    systemPrompt: systemPrompt || 'You are a helpful customer service agent. Reply to customer comments professionally.',
    userMessage: `A customer commented: "${commentText}"\n\nPlease write a friendly reply.`,
    businessName,
    context: 'This is a reply to a social media comment.',
    maxTokens: 100,
  });
}

/**
 * Generate a DM reply
 */
export async function generateDMReply(
  messageText: string,
  systemPrompt: string,
  businessName?: string
): Promise<string | null> {
  return generateAIResponse({
    systemPrompt: systemPrompt || 'You are a helpful customer service agent. Reply to customer messages professionally.',
    userMessage: messageText,
    businessName,
    context: 'This is a direct message conversation.',
    maxTokens: 150,
  });
}
