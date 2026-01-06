import OpenAI from 'openai';
import { env } from '@/lib/env';
import { createServerClient } from '@/lib/supabase/server';

// Initialize OpenAI client
const openaiClient = new OpenAI({
  apiKey: env.openai.apiKey,
});

/**
 * Call OpenAI Chat API with usage tracking
 * Used for agent conversations
 */
export async function callOpenAIChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = 'gpt-4o-mini',
  options?: {
    temperature?: number;
    max_tokens?: number;
  }
): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
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

    return {
      content,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      }
    };
  } catch (err: any) {
    console.error('OpenAI API error:', err.message);
    throw err;
  }
}

/**
 * Call OpenAI for agent completion with usage tracking
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

  const result = await callOpenAIChat(messages, options?.model || 'gpt-4o-mini', {
    temperature: options?.temperature,
    max_tokens: options?.max_tokens,
  });

  return result.content;
}

/**
 * Call OpenAI for agent completion with usage tracking and recording
 */
export async function generateAgentResponseWithTracking(
  workspaceId: string,
  agentId: string | null,
  sessionId: string | null,
  systemPrompt: string,
  userMessage: string,
  platform: string | null = null,
  options?: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }
): Promise<{ content: string; tokensUsed: number; costCents: number }> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage },
  ];

  const model = options?.model || 'gpt-4o-mini';
  const result = await callOpenAIChat(messages, model, {
    temperature: options?.temperature,
    max_tokens: options?.max_tokens,
  });

  // Calculate cost
  const costCents = Math.round(calculateOpenAICost(
    result.usage.prompt_tokens,
    result.usage.completion_tokens,
    model
  ) * 100); // Convert to cents

  // Record usage (async, don't block response)
  recordAIUsage({
    workspaceId,
    agentId,
    sessionId,
    userMessage,
    assistantMessage: result.content,
    tokensUsed: result.usage.total_tokens,
    costCents,
    model,
    platform
  }).catch(err => {
    console.error('[AI Usage] Failed to record usage:', err);
  });

  return {
    content: result.content,
    tokensUsed: result.usage.total_tokens,
    costCents
  };
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

/**
 * Record AI usage in database
 */
export async function recordAIUsage(params: {
  workspaceId: string;
  agentId: string | null;
  sessionId: string | null;
  userMessage: string;
  assistantMessage: string;
  tokensUsed: number;
  costCents: number;
  model: string;
  platform: string | null;
}): Promise<void> {
  try {
    const supabase = await createServerClient();

    // Call the database function to record usage
    const { error } = await supabase.rpc('record_ai_usage', {
      p_workspace_id: params.workspaceId,
      p_tokens_used: params.tokensUsed,
      p_cost_cents: params.costCents,
      p_model: params.model,
      p_agent_id: params.agentId,
      p_session_id: params.sessionId,
      p_user_message: params.userMessage,
      p_assistant_message: params.assistantMessage,
      p_platform: params.platform
    });

    if (error) {
      console.error('[AI Usage] Failed to record usage:', error);
      throw error;
    }
  } catch (err: any) {
    console.error('[AI Usage] Database error:', err.message);
    // Don't throw - we don't want usage tracking to break the main flow
  }
}
