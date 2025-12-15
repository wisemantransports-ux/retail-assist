import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { createMockAdminSupabaseClient } from '@/lib/supabase/server';
import { getAgentById, saveComment, createDirectMessage, markCommentProcessed } from '@/lib/supabase/queries';
import { generateAgentResponse, estimateTokens } from '@/lib/openai/server';
import { generateMockResponse } from '@/lib/openai/mock';
import { env } from '@/lib/env';

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const body = await request.json();
    const { author_email, content } = body;

    if (!content) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }

    // Handle mock mode
    if (env.useMockMode) {
      const mockReply = await generateMockResponse(
        'You are a helpful retail assistant',
        content
      );
      return NextResponse.json({ reply: mockReply });
    }

    const supabase = await createServerSupabaseClient();
    const adminSupabase = await createAdminSupabaseClient();

    // Get agent
    const agent = await getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Verify agent is enabled
    if (!agent.enabled) {
      return NextResponse.json(
        { error: 'Agent is disabled' },
        { status: 403 }
      );
    }

    // Save public comment
    const comment = await saveComment(agentId, {
      platform: 'website', // Default to website for direct API comments
      author_email,
      content,
    });

    if (!comment) {
      console.warn('Failed to save comment to database');
    }

    // Generate bot reply
    let reply: string;
    try {
      const systemPrompt = agent.system_prompt || 'You are a helpful assistant for retail support.';
      const model = agent.model || 'gpt-4o-mini';

      if (env.openai.apiKey && !env.isTestMode) {
        reply = await generateAgentResponse(systemPrompt, content, {
          model,
          temperature: agent.temperature,
          max_tokens: agent.max_tokens,
        });
      } else {
        reply = await generateMockResponse(systemPrompt, content);
      }
    } catch (openaiErr: any) {
      console.error('OpenAI error:', openaiErr);
      reply = agent.fallback || 'Thank you for your comment. We\'ll get back to you soon!';
    }

    // Send DM to commenter (if email provided)
    const recipientId = author_email || `anon_${Date.now()}`;
    if (recipientId && recipientId.includes('@')) {
      try {
        await createDirectMessage(agent.workspace_id, {
          agent_id: agentId,
          recipient_id: recipientId,
          recipient_name: author_email ? author_email.split('@')[0] : undefined,
          content: reply,
          platform: 'email',
          status: 'sent',
        });
      } catch (dmErr) {
        console.warn('Failed to create DM:', dmErr);
      }
    }

    // Mark comment as processed
    if (comment) {
      try {
        await markCommentProcessed(comment.id, reply);
      } catch (err) {
        console.warn('Failed to mark comment processed:', err);
      }
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('Error in comments endpoint:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
