import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { db } from '@/lib/db';
import { verifyWebhookSignature, fbSendDM } from '@/lib/facebook';
import { upsertConversation, insertMessage } from '@/lib/inbox/queries';
import { listAgentsForWorkspace, listWorkspacesForUser } from '@/lib/supabase/queries';

const WEBHOOK_LOG_PREFIX = '[Instagram Webhook]';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const verifyToken = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log(`${WEBHOOK_LOG_PREFIX} Verification request:`, {
      mode,
      verifyToken: verifyToken ? '***' : 'MISSING',
    });

    if (mode !== 'subscribe') {
      return new NextResponse('Invalid mode', { status: 400 });
    }

    if (!env.meta.verifyToken) {
      return new NextResponse('Webhook token not configured', { status: 500 });
    }

    if (verifyToken !== env.meta.verifyToken) {
      return new NextResponse('Invalid verify token', { status: 403 });
    }

    if (!challenge) {
      return new NextResponse('Missing challenge', { status: 400 });
    }

    console.log(`${WEBHOOK_LOG_PREFIX} Webhook verified successfully`);
    return new NextResponse(challenge, { status: 200 });
  } catch (error: any) {
    console.error(`${WEBHOOK_LOG_PREFIX} Error in verification:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log(`${WEBHOOK_LOG_PREFIX} Received webhook request`);

    const rawBody = await request.text();
    const xHubSignature = request.headers.get('x-hub-signature-256') || '';

    if (!verifyWebhookSignature(rawBody, xHubSignature)) {
      console.warn(`${WEBHOOK_LOG_PREFIX} Invalid webhook signature`);
      if (!env.isDevelopment) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error(`${WEBHOOK_LOG_PREFIX} Invalid JSON`);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (body.object !== 'instagram') {
      console.log(`${WEBHOOK_LOG_PREFIX} Ignoring non-instagram webhook:`, body.object);
      return NextResponse.json({ ok: true });
    }

    if (!body.entry || !Array.isArray(body.entry)) {
      return NextResponse.json({ ok: true });
    }

    let processedCount = 0;

    for (const entry of body.entry) {
      try {
        await processInstagramEntry(entry);
        processedCount++;
      } catch (error: any) {
        console.error(`${WEBHOOK_LOG_PREFIX} Error processing entry:`, error.message);
        await db.logs.add({
          level: 'error',
          message: `Instagram webhook error: ${error.message}`,
          meta: { entryId: entry.id }
        });
      }
    }

    console.log(`${WEBHOOK_LOG_PREFIX} Processed ${processedCount} entries`);

    return NextResponse.json({
      ok: true,
      processed: processedCount,
    });
  } catch (error: any) {
    console.error(`${WEBHOOK_LOG_PREFIX} Unexpected error:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processInstagramEntry(entry: any) {
  const igUserId = entry.id;
  console.log(`${WEBHOOK_LOG_PREFIX} Processing entry for IG user:`, igUserId);

  const token = await db.tokens.findByPageId(igUserId);
  
  if (!token) {
    console.warn(`${WEBHOOK_LOG_PREFIX} No token found for IG user:`, igUserId);
    return;
  }

  const user = await db.users.findById(token.user_id);
  
  if (!user || user.subscription_status !== 'active') {
    console.warn(`${WEBHOOK_LOG_PREFIX} User not active:`, igUserId);
    return;
  }

  const settings = await db.settings.findByUserId(user.id);
  
  if (!settings || !settings.auto_reply_enabled) {
    console.log(`${WEBHOOK_LOG_PREFIX} Auto-reply not enabled`);
    return;
  }

  if (entry.messaging) {
    for (const msg of entry.messaging) {
      if (msg.message && msg.sender) {
        await handleInstagramMessage(user, settings, token, msg);
      }
    }
  }

  if (entry.changes) {
    for (const change of entry.changes) {
      if (change.field === 'comments') {
        await handleInstagramComment(user, settings, token, change.value);
      }
    }
  }
}

async function handleInstagramMessage(user: any, settings: any, token: any, msg: any) {
  try {
    console.log(`${WEBHOOK_LOG_PREFIX} Processing IG message from:`, msg.sender.id);
    // Persist incoming message (best-effort)
    try {
      const workspacesRes = await listWorkspacesForUser(user.id)
      const workspace = workspacesRes?.data?.[0]
      if (workspace) {
        const agentsRes = await listAgentsForWorkspace(workspace.id)
        const defaultAgent = agentsRes?.data?.[0]
        const conv = await upsertConversation(null, {
          workspaceId: workspace.id,
          agentId: defaultAgent?.id || null,
          platform: 'instagram',
          externalThreadId: msg.threadId || msg.id,
          customerId: msg.sender.id,
          customerName: msg.sender.name || null,
          text: msg.message.text || null,
        })

        await insertMessage(null, {
          workspaceId: workspace.id,
          conversation: { id: conv.id, type: conv.type as 'dm' | 'comment' },
          sender: 'customer',
          content: msg.message.text || '',
          externalMessageId: msg.id,
          platform: 'instagram',
        })
      }
    } catch (persistErr: any) {
      console.warn(`${WEBHOOK_LOG_PREFIX} Failed to persist IG incoming message:`, persistErr?.message || persistErr)
      await db.logs.add({ user_id: user.id, level: 'warn', message: 'Failed to persist IG incoming message', meta: { err: (persistErr||{}).message || persistErr } })
    }

    const replyText = settings.greeting_message || 'Thanks for your message!';

    const result = await fbSendDM(msg.sender.id, replyText, token.access_token);

    if (result.success) {
      console.log(`${WEBHOOK_LOG_PREFIX} IG DM reply sent:`, result.messageId);
      await db.logs.add({
        user_id: user.id,
        level: 'info',
        message: 'Instagram DM replied',
        meta: { senderId: msg.sender.id }
      });
    }
  } catch (error: any) {
    console.error(`${WEBHOOK_LOG_PREFIX} Error handling IG message:`, error.message);
  }
}

async function handleInstagramComment(user: any, settings: any, token: any, comment: any) {
  try {
    console.log(`${WEBHOOK_LOG_PREFIX} Processing IG comment:`, comment.id);
    // Persist incoming comment (best-effort)
    try {
      const workspacesRes = await listWorkspacesForUser(user.id)
      const workspace = workspacesRes?.data?.[0]
      if (workspace) {
        const agentsRes = await listAgentsForWorkspace(workspace.id)
        const defaultAgent = agentsRes?.data?.[0]
        const conv = await upsertConversation(null, {
          workspaceId: workspace.id,
          agentId: defaultAgent?.id || null,
          platform: 'instagram',
          externalThreadId: comment.id,
          customerId: comment.from?.id,
          customerName: comment.from?.name || null,
          text: comment.text || null,
        })

        await insertMessage(null, {
          workspaceId: workspace.id,
          conversation: { id: conv.id, type: conv.type as 'dm' | 'comment' },
          sender: 'customer',
          content: comment.text || '',
          externalMessageId: comment.id,
          platform: 'instagram',
        })
      }
    } catch (persistErr: any) {
      console.warn(`${WEBHOOK_LOG_PREFIX} Failed to persist IG comment:`, persistErr?.message || persistErr)
      await db.logs.add({ user_id: user.id, level: 'warn', message: 'Failed to persist IG comment', meta: { err: (persistErr||{}).message || persistErr } })
    }

    if (settings.comment_to_dm_enabled && comment.from?.id) {
      const dmText = `Hi! Thanks for commenting on our post. ${settings.greeting_message}`;
      
      const result = await fbSendDM(comment.from.id, dmText, token.access_token);

      if (result.success) {
        console.log(`${WEBHOOK_LOG_PREFIX} IG comment-to-DM sent:`, result.messageId);
        await db.logs.add({
          user_id: user.id,
          level: 'info',
          message: 'Instagram comment-to-DM sent',
          meta: { commentId: comment.id, userId: comment.from.id }
        });
      }
    }
  } catch (error: any) {
    console.error(`${WEBHOOK_LOG_PREFIX} Error handling IG comment:`, error.message);
  }
}
