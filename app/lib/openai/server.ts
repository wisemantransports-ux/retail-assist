import OpenAI from 'openai';
import { env } from '@/lib/env';

// Initialize OpenAI client
const openaiClient = new OpenAI({
  apiKey: env.openai.apiKey,
});

/**
 * Call OpenAI Chat API
 * Used for agent conversations
 */
export async function callOpenAIChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = 'gpt-4o-mini',
  options?: {
    temperature?: number;
    max_tokens?: number;
  }
): Promise<string> {
  if (!env.openai.apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await openaiClient.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return content;
  } catch (err: any) {
    console.error('OpenAI API error:', err.message);
    throw err;
  }
}

/**
 * Call OpenAI for agent completion
 */
export async function generateAgentResponse(
  systemPrompt: string,
  userMessage: string,
  options?: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }
): Promise<string> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage },
  ];

  return callOpenAIChat(messages, options?.model || 'gpt-4o-mini', {
    temperature: options?.temperature,
    max_tokens: options?.max_tokens,
  });
}

/**
 * Count tokens for OpenAI messages
 * Approximate token count (rough estimate)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost of API call
 * Costs as of 2024 (subject to change)
 */
export function calculateOpenAICost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'gpt-4o-mini'
): number {
  // gpt-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens
  // gpt-4o: $5 per 1M input tokens, $15 per 1M output tokens
  // gpt-3.5-turbo: $0.50 per 1M input tokens, $1.50 per 1M output tokens

  let inputCost = 0;
  let outputCost = 0;

  switch (model) {
    case 'gpt-4o':
      inputCost = (inputTokens / 1_000_000) * 5;
      outputCost = (outputTokens / 1_000_000) * 15;
      break;
    case 'gpt-4o-mini':
      inputCost = (inputTokens / 1_000_000) * 0.15;
      outputCost = (outputTokens / 1_000_000) * 0.60;
      break;
    case 'gpt-3.5-turbo':
      inputCost = (inputTokens / 1_000_000) * 0.50;
      outputCost = (outputTokens / 1_000_000) * 1.50;
      break;
    default:
      // Use gpt-4o-mini as default
      inputCost = (inputTokens / 1_000_000) * 0.15;
      outputCost = (outputTokens / 1_000_000) * 0.60;
  }

  return inputCost + outputCost;
}
