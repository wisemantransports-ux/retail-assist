import { NextResponse } from 'next/server';
import { createServerClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { getAgentById, saveComment, createDirectMessage, markCommentProcessed } from '@/lib/supabase/queries';
import { upsertConversation, insertMessage } from '@/lib/inbox/queries';
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

    const supabase = await createServerClient();
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

    // Persist inbound message to inbox helpers (best-effort, do not block)
    let conv: any = null;
    try {
      conv = await upsertConversation(null, {
        workspaceId: agent.workspace_id,
        agentId: agentId,
        platform: 'website',
        externalThreadId: comment?.platform_comment_id || null,
        customerId: author_email || null,
        customerName: author_email ? author_email.split('@')[0] : null,
        text: content,
      });

      try {
        await insertMessage(null, {
          workspaceId: agent.workspace_id,
          conversation: { id: conv.id, type: conv.type as 'dm' | 'comment' },
          sender: 'customer',
          content,
          externalMessageId: comment?.platform_comment_id || null,
          platform: 'website',
        });
      } catch (mErr: any) {
        console.warn('Failed to insert inbound message into inbox helpers:', mErr?.message || mErr);
      }
    } catch (persistErr: any) {
      console.warn('Failed to persist inbound website conversation (non-blocking):', persistErr?.message || persistErr);
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

    // Persist bot reply to inbox before creating any DM/send actions
    const conversationId = conv?.id || comment?.id;
    try {
      if (conversationId) {
        await insertMessage(null, {
          workspaceId: agent.workspace_id,
          conversation: { id: conversationId, type: 'comment' },
          sender: 'bot',
          content: reply,
          externalMessageId: null,
          platform: 'website',
        });
      }
    } catch (persistBotErr: any) {
      console.warn('Failed to persist bot reply to inbox (non-blocking):', persistBotErr?.message || persistBotErr);
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
