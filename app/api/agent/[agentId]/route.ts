import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { createMockAdminSupabaseClient } from '@/lib/supabase/server';
import { getAgentById, logMessage } from '@/lib/supabase/queries';
import { callOpenAIChat, generateAgentResponse, estimateTokens, calculateOpenAICost } from '@/lib/openai/server';
import { generateMockResponse } from '@/lib/openai/mock';
import { env } from '@/lib/env';

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    // Handle mock mode
    if (env.useMockMode) {
      const mockReply = await generateMockResponse('You are a helpful assistant', message);
      return NextResponse.json({ reply: mockReply });
    }

    const supabase = await createServerSupabaseClient();
    const adminSupabase = await createAdminSupabaseClient();

    // Get API key from headers (for public API)
    const apiKeyHeader = request.headers.get('x-api-key') || 
      request.headers.get('authorization')?.replace(/^Bearer\s+/, '');

    let agent: any = null;
    let isApiKeyAuth = false;

    if (apiKeyHeader) {
      // Lookup agent by API key (requires admin client to bypass RLS)
      const { data: agentRow, error: keyErr } = await adminSupabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('api_key', apiKeyHeader)
        .is('deleted_at', null)
        .single();

      if (keyErr || !agentRow) {
        return NextResponse.json(
          { error: 'Invalid API key or agent not found' },
          { status: 401 }
        );
      }

      agent = agentRow;
      isApiKeyAuth = true;
    } else {
      // Require authenticated session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get agent - RLS will filter to user's workspace
      agent = await getAgentById(agentId);
      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
    }

    // Verify agent is enabled
    if (!agent.enabled) {
      return NextResponse.json({ error: 'Agent is disabled' }, { status: 403 });
    }

    // Generate response using OpenAI or mock
    const systemPrompt = agent.system_prompt || 'You are a helpful assistant for retail support.';
    const model = agent.model || 'gpt-4o-mini';

    let reply: string;
    let tokensUsed = 0;
    let cost = 0;

    try {
      if (env.openai.apiKey && !env.isTestMode) {
        // Use real OpenAI
        reply = await generateAgentResponse(systemPrompt, message, {
          model,
          temperature: agent.temperature,
          max_tokens: agent.max_tokens,
        });

        // Estimate tokens and cost
        tokensUsed = estimateTokens(message) + estimateTokens(reply);
        cost = calculateOpenAICost(estimateTokens(message), estimateTokens(reply), model);
      } else {
        // Use mock OpenAI
        reply = await generateMockResponse(systemPrompt, message);
        tokensUsed = estimateTokens(message) + estimateTokens(reply);
        cost = 0; // Mock has no cost
      }
    } catch (openaiErr: any) {
      console.error('OpenAI error:', openaiErr);
      reply = agent.fallback || 'Sorry, I\'m having trouble responding right now. Please try again later.';
      tokensUsed = 0;
      cost = 0;
    }

    // Log message to database (best-effort)
    try {
      const agentWorkspaceId = agent.workspace_id;
      await logMessage(agentWorkspaceId, {
        agent_id: agentId,
        user_message: message,
        assistant_message: reply,
        tokens_used: tokensUsed,
        cost,
        platform: isApiKeyAuth ? 'direct_api' : 'dashboard',
      });
    } catch (logErr) {
      console.warn('Failed to log message:', logErr);
    }

    return NextResponse.json({ reply, tokens_used: tokensUsed, cost });
  } catch (err: any) {
    console.error('Error in agent endpoint:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
