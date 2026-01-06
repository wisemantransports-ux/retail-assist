import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAgentById } from '@/lib/supabase/queries';
import { upsertConversation, insertMessage } from '@/lib/inbox/queries';
import { executeAutomationRulesForMessage } from '@/lib/automation/executeAutomationRules';
import { generateAgentResponseWithTracking } from '../../../lib/openai/server';
import { generateMockResponse } from '@/lib/openai/mock';
import { env } from '@/lib/env';

export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const body = await request.json();
    const { content, sessionId } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required and must be a string' }, { status: 400 });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required and must be a string' }, { status: 400 });
    }

    // Basic rate limiting - max 5 messages per minute per session
    const rateLimitKey = `chat_rate_${sessionId}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 5;

    // Simple in-memory rate limiting (for MVP - consider Redis for production)
    if (!(globalThis as any).rateLimitStore) {
      (globalThis as any).rateLimitStore = new Map();
    }
    const store = (globalThis as any).rateLimitStore;

    const sessionData = store.get(rateLimitKey) || { count: 0, resetTime: now + windowMs };
    if (now > sessionData.resetTime) {
      sessionData.count = 0;
      sessionData.resetTime = now + windowMs;
    }

    if (sessionData.count >= maxRequests) {
      return NextResponse.json({ error: 'Too many messages. Please wait before sending another message.' }, { status: 429 });
    }

    sessionData.count++;
    store.set(rateLimitKey, sessionData);

    const supabase = await createServerClient();

    // Get agent
    const agent = await getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Verify agent is enabled
    if (!agent.enabled) {
      return NextResponse.json({ error: 'Agent is disabled' }, { status: 403 });
    }

    // Persist inbound message to inbox
    let conv: any = null;
    try {
      conv = await upsertConversation(null, {
        workspaceId: agent.workspace_id,
        agentId: agentId,
        platform: 'website',
        externalThreadId: sessionId,
        customerId: sessionId,
        customerName: `Visitor ${sessionId.slice(-4)}`,
        text: content,
      });

      await insertMessage(null, {
        workspaceId: agent.workspace_id,
        conversation: { id: conv.id, type: conv.type },
        sender: 'customer',
        content,
        externalMessageId: null,
        platform: 'website',
      });
    } catch (persistErr: any) {
      console.warn('Failed to persist inbound website message (non-blocking):', persistErr?.message || persistErr);
    }

    // Trigger automation rules first (mirror Meta behavior)
    let reply: string | null = null;
    try {
      if (!env.useMockMode) {
        const automationResult = await executeAutomationRulesForMessage({
          workspaceId: agent.workspace_id,
          agentId,
          commentId: conv?.id,
          commentText: content,
          authorId: sessionId,
          authorName: `Visitor ${sessionId.slice(-4)}`,
          platform: 'website',
        });

        // If automation executed and returned a reply, use it
        if (automationResult.reply) {
          reply = automationResult.reply;
        }
      }
    } catch (autoErr: any) {
      console.warn('Automation execution failed, falling back to AI:', autoErr?.message || autoErr);
    }

    // If no automation reply, generate AI fallback
    if (!reply) {
      try {
        const systemPrompt = agent.system_prompt || 'You are a helpful assistant for retail support.';
        const model = agent.model || 'gpt-4o-mini';

        if (env.openai.apiKey && !env.isTestMode) {
          const result = await generateAgentResponseWithTracking(
            agent.workspace_id,
            agentId,
            sessionId,
            systemPrompt,
            content,
            'website',
            {
              model,
              temperature: agent.temperature,
              max_tokens: agent.max_tokens,
            }
          );
          reply = result.content;
        } else {
          reply = await generateMockResponse(systemPrompt, content);
        }
      } catch (openaiErr: any) {
        console.error('OpenAI error:', openaiErr);
        reply = agent.fallback || 'Thank you for your message. We\'ll get back to you soon!';
      }
    }

    // Persist bot reply to inbox
    try {
      if (conv) {
        await insertMessage(null, {
          workspaceId: agent.workspace_id,
          conversation: { id: conv.id, type: conv.type },
          sender: 'bot',
          content: reply,
          externalMessageId: null,
          platform: 'website',
        });
      }
    } catch (persistBotErr: any) {
      console.warn('Failed to persist bot reply to inbox (non-blocking):', persistBotErr?.message || persistBotErr);
    }

    return NextResponse.json({ reply, conversationId: conv?.id });
  } catch (err: any) {
    console.error('Error in POST /api/chat/[agentId]:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch conversation history
export async function GET(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Get agent to verify workspace access
    const agent = await getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // For website conversations, we need to find messages by sessionId
    // Website uses comments table for conversations, but we need to get all messages
    // First, find the conversation by platform_comment_id
    const { data: conversation, error: convError } = await supabase
      .from('comments')
      .select('id')
      .eq('agent_id', agentId)
      .eq('platform_comment_id', sessionId)
      .eq('platform', 'website')
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ messages: [] });
    }

    // Get all messages for this conversation from the inbox
    // For website, customer messages are in comments, bot replies are in direct_messages or comments
    // Let's query both and combine

    // Customer messages from comments
    const { data: customerMessages } = await supabase
      .from('comments')
      .select('*')
      .eq('id', conversation.id);

    // Bot replies - could be in comments (bot_reply) or direct_messages
    // For simplicity, let's check if there's a bot_reply in the comment
    const messages: any[] = [];

    if (customerMessages && customerMessages.length > 0) {
      const comment = customerMessages[0];
      messages.push({
        id: comment.id,
        sender: 'customer',
        content: comment.text,
        timestamp: comment.created_at,
      });

      if (comment.bot_reply) {
        messages.push({
          id: `${comment.id}-reply`,
          sender: 'bot',
          content: comment.bot_reply,
          timestamp: comment.updated_at || comment.created_at,
        });
      }
    }

    // Sort by timestamp
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error('Error in GET /api/chat/[agentId]:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}