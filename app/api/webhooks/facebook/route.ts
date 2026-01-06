import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { db } from '@/lib/db';
import {
  parseFacebookWebhook,
  verifyWebhookSignature,
  fbReplyToComment,
  fbSendDM,
} from '@/lib/facebook';
import { upsertConversation, insertMessage } from '@/lib/inbox/queries';
import { listAgentsForWorkspace, listWorkspacesForUser } from '@/lib/supabase/queries';
import { generateCommentReply, generateDMReply } from '@/lib/ai';

const WEBHOOK_LOG_PREFIX = '[Facebook Webhook]';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const verifyToken = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log(`${WEBHOOK_LOG_PREFIX} Verification request:`, {
      mode,
      verifyToken: verifyToken ? '***' : 'MISSING',
      challenge: challenge ? '***' : 'MISSING',
    });

    if (mode !== 'subscribe') {
      console.warn(`${WEBHOOK_LOG_PREFIX} Invalid mode:`, mode);
      return new NextResponse('Invalid mode', { status: 400 });
    }

    if (!env.meta.verifyToken) {
      console.error(`${WEBHOOK_LOG_PREFIX} META_VERIFY_TOKEN not configured`);
      return new NextResponse('Webhook token not configured', { status: 500 });
    }

    if (verifyToken !== env.meta.verifyToken) {
      console.warn(`${WEBHOOK_LOG_PREFIX} Invalid verify token`);
      return new NextResponse('Invalid verify token', { status: 403 });
    }

    if (!challenge) {
      console.warn(`${WEBHOOK_LOG_PREFIX} Missing challenge`);
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
  let eventCount = 0;
  let processedCount = 0;

  try {
    console.log(`${WEBHOOK_LOG_PREFIX} Received webhook request`);

    const rawBody = await request.text();
    const xHubSignature = request.headers.get('x-hub-signature-256') || '';

    if (!verifyWebhookSignature(rawBody, xHubSignature)) {
      console.warn(`${WEBHOOK_LOG_PREFIX} Invalid webhook signature`);
      if (env.meta.appSecret) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error(`${WEBHOOK_LOG_PREFIX} Invalid JSON in request body`);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (body.object !== 'page' && body.object !== 'instagram') {
      console.log(`${WEBHOOK_LOG_PREFIX} Ignoring non-page webhook:`, body.object);
      return NextResponse.json({ ok: true });
    }

    if (!body.entry || !Array.isArray(body.entry)) {
      console.log(`${WEBHOOK_LOG_PREFIX} No entries in webhook`);
      return NextResponse.json({ ok: true });
    }

    eventCount = body.entry.length;
    console.log(`${WEBHOOK_LOG_PREFIX} Processing ${eventCount} entries`);

    for (const entry of body.entry) {
      try {
        await processEntry(entry, body);
        processedCount++;
      } catch (entryError: any) {
        console.error(`${WEBHOOK_LOG_PREFIX} Error processing entry:`, entryError.message);
        await db.logs.add({
          level: 'error',
          message: `Webhook entry error: ${entryError.message}`,
          meta: { entryId: entry.id }
        });
      }
    }

    console.log(`${WEBHOOK_LOG_PREFIX} Webhook processed:`, { eventCount, processedCount });

    return NextResponse.json({
      ok: true,
      processed: processedCount,
      total: eventCount,
    });
  } catch (error: any) {
    console.error(`${WEBHOOK_LOG_PREFIX} Unexpected error:`, error.message);
    await db.logs.add({
      level: 'error',
      message: `Webhook error: ${error.message}`
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processEntry(entry: any, fullPayload: any) {
  try {
    const pageId = entry.id;
    console.log(`${WEBHOOK_LOG_PREFIX} Processing entry for page:`, pageId);

    const token = await db.tokens.findByPageId(pageId);
    
    if (!token) {
      console.warn(`${WEBHOOK_LOG_PREFIX} No token found for page:`, pageId);
      return;
    }

    const user = await db.users.findById(token.user_id);
    
    if (!user || user.subscription_status !== 'active') {
      console.warn(`${WEBHOOK_LOG_PREFIX} User not active for page:`, pageId);
      return;
    }

    const settings = await db.settings.findByUserId(user.id);
    
    if (!settings) {
      console.warn(`${WEBHOOK_LOG_PREFIX} No settings found for user:`, user.id);
      return;
    }

    console.log(`${WEBHOOK_LOG_PREFIX} Found user:`, user.business_name);

    const event = parseFacebookWebhook(fullPayload);
    if (!event || event.eventType === 'unknown') {
      console.log(`${WEBHOOK_LOG_PREFIX} Unknown or unhandled event type`);
      return;
    }

    console.log(`${WEBHOOK_LOG_PREFIX} Detected event:`, event.eventType);

    await db.logs.add({
      user_id: user.id,
      level: 'info',
      message: `Received ${event.eventType} event`,
      meta: { pageId, platform: token.platform }
    });

    if (event.eventType === 'comment' && event.comment && settings.auto_reply_enabled) {
        await handleCommentEvent(user, settings, token, event.comment);
    } else if (event.eventType === 'message' && event.message && settings.auto_reply_enabled) {
        await handleMessageEvent(user, settings, token, event.message);
    }
  } catch (error: any) {
    console.error(`${WEBHOOK_LOG_PREFIX} Error in processEntry:`, error.message);
    throw error;
  }
}

async function handleCommentEvent(user: any, settings: any, token: any, comment: any) {
  let workspacesRes: any = null;
  let defaultAgent: any = null;

  try {
    console.log(`${WEBHOOK_LOG_PREFIX} Processing comment:`, comment.id);

    // Persist incoming comment to inbox (best-effort — do not block automation if persistence fails)
    try {
      workspacesRes = await listWorkspacesForUser(user.id)
      const workspace = workspacesRes?.data?.[0]
      if (workspace) {
        const agentsRes = await listAgentsForWorkspace(workspace.id)
        defaultAgent = agentsRes?.data?.[0]
        const conv = await upsertConversation(null, {
          workspaceId: workspace.id,
          agentId: defaultAgent?.id || null,
          platform: token.platform === 'instagram' ? 'instagram' : 'facebook',
          externalThreadId: comment.id,
          customerId: comment.authorId,
          customerName: comment.authorName,
          text: comment.text,
        })

        await insertMessage(null, {
          workspaceId: workspace.id,
          conversation: { id: conv.id, type: conv.type as 'dm' | 'comment' },
          sender: 'customer',
          content: comment.text,
          externalMessageId: comment.id,
          platform: token.platform === 'instagram' ? 'instagram' : 'facebook',
        })
      }
    } catch (persistErr: any) {
      console.warn(`${WEBHOOK_LOG_PREFIX} Failed to persist incoming comment:`, persistErr?.message || persistErr)
      await db.logs.add({ user_id: user.id, level: 'warn', message: 'Failed to persist incoming comment', meta: { err: (persistErr||{}).message || persistErr } })
    }

    let replyText = settings.greeting_message || 'Thanks for your comment!';

    if (settings.ai_enabled && settings.system_prompt && comment.text) {
      console.log(`${WEBHOOK_LOG_PREFIX} Generating AI response for comment`);
      const aiReply = await generateCommentReply(
        workspacesRes.data?.[0]?.id || '',
        defaultAgent?.id,
        comment.text,
        settings.system_prompt,
        user.business_name,
        token.platform === 'instagram' ? 'instagram' : 'facebook'
      );
      if (aiReply) {
        replyText = aiReply;
        console.log(`${WEBHOOK_LOG_PREFIX} Using AI-generated reply`);
      }
    }

    const replyResult = await fbReplyToComment(comment.id, replyText, token.access_token);

    if (replyResult.success) {
      console.log(`${WEBHOOK_LOG_PREFIX} Comment reply sent:`, replyResult.replyId);
      
      if (settings.comment_to_dm_enabled) {
        let dmText = `Hi! Thanks for commenting on our post. ${settings.greeting_message || ''}`;
        
        if (settings.ai_enabled && settings.system_prompt) {
          const aiDm = await generateDMReply(
            workspacesRes.data?.[0]?.id || '',
            defaultAgent?.id,
            `Customer commented: "${comment.text}". Send a follow-up DM.`,
            settings.system_prompt,
            user.business_name,
            token.platform === 'instagram' ? 'instagram' : 'facebook'
          );
          if (aiDm) dmText = aiDm;
        }
        
        const dmResult = await fbSendDM(comment.authorId, dmText, token.access_token);
        
        if (dmResult.success) {
          console.log(`${WEBHOOK_LOG_PREFIX} Comment-to-DM sent:`, dmResult.messageId);
          // persist the DM that we sent
          try {
            const workspacesRes = await listWorkspacesForUser(user.id)
            const workspace = workspacesRes?.data?.[0]
            if (workspace) {
              await upsertConversation(null, {
                workspaceId: workspace.id,
                agentId: null,
                platform: token.platform === 'instagram' ? 'instagram' : 'facebook',
                externalThreadId: comment.id,
                customerId: comment.authorId,
                customerName: comment.authorName,
                text: dmText,
              })
            }
          } catch (e:any) {
            // don't block flow
            await db.logs.add({ user_id: user.id, level: 'warn', message: 'Failed to persist comment-to-dm', meta: { err: (e||{}).message || e } })
          }
        }
      }

      await db.logs.add({
        user_id: user.id,
        level: 'info',
        message: 'Comment replied successfully',
        meta: { commentId: comment.id, replyId: replyResult.replyId, aiGenerated: settings.ai_enabled }
      });
    } else {
      await db.logs.add({
        user_id: user.id,
        level: 'error',
        message: `Comment reply failed: ${replyResult.error}`,
        meta: { commentId: comment.id }
      });
    }
  } catch (error: any) {
    console.error(`${WEBHOOK_LOG_PREFIX} Error handling comment:`, error.message);
    await db.logs.add({
      user_id: user.id,
      level: 'error',
      message: `Comment handling error: ${error.message}`,
      meta: { commentId: comment.id }
    });
  }
}

async function handleMessageEvent(user: any, settings: any, token: any, message: any) {
  let workspacesRes: any = null;
  let defaultAgent: any = null;

  try {
    console.log(`${WEBHOOK_LOG_PREFIX} Processing message:`, message.id);

    // Persist incoming message to inbox (best-effort)
    try {
      workspacesRes = await listWorkspacesForUser(user.id)
      const workspace = workspacesRes?.data?.[0]
      if (workspace) {
        const agentsRes = await listAgentsForWorkspace(workspace.id)
        defaultAgent = agentsRes?.data?.[0]
        const conv = await upsertConversation(null, {
          workspaceId: workspace.id,
          agentId: defaultAgent?.id || null,
          platform: token.platform === 'instagram' ? 'instagram' : 'facebook',
          externalThreadId: message.threadId || message.id,
          customerId: message.senderId,
          customerName: message.senderName,
          text: message.text,
        })

        await insertMessage(null, {
          workspaceId: workspace.id,
          conversation: { id: conv.id, type: conv.type as 'dm' | 'comment' },
          sender: 'customer',
          content: message.text,
          externalMessageId: message.id,
          platform: token.platform === 'instagram' ? 'instagram' : 'facebook',
        })
      }
    } catch (persistErr: any) {
      console.warn(`${WEBHOOK_LOG_PREFIX} Failed to persist incoming message:`, persistErr?.message || persistErr)
      await db.logs.add({ user_id: user.id, level: 'warn', message: 'Failed to persist incoming message', meta: { err: (persistErr||{}).message || persistErr } })
    }

    let replyText = settings.greeting_message || 'Thanks for your message! We will get back to you soon.';

    if (settings.ai_enabled && settings.system_prompt && message.text) {
      console.log(`${WEBHOOK_LOG_PREFIX} Generating AI response for message`);
      const aiReply = await generateDMReply(
        workspacesRes.data?.[0]?.id || '',
        defaultAgent?.id,
        message.text,
        settings.system_prompt,
        user.business_name,
        token.platform === 'instagram' ? 'instagram' : 'facebook'
      );
      if (aiReply) {
        replyText = aiReply;
        console.log(`${WEBHOOK_LOG_PREFIX} Using AI-generated reply`);
      }
    }

    const dmResult = await fbSendDM(message.senderId, replyText, token.access_token);

    if (dmResult.success) {
      console.log(`${WEBHOOK_LOG_PREFIX} DM reply sent:`, dmResult.messageId);

      await db.logs.add({
        user_id: user.id,
        level: 'info',
        message: 'Message replied successfully',
        meta: { messageId: message.id, replyId: dmResult.messageId, aiGenerated: settings.ai_enabled }
      });
    } else {
      await db.logs.add({
        user_id: user.id,
        level: 'error',
        message: `Message reply failed: ${dmResult.error}`,
        meta: { messageId: message.id }
      });
    }
  } catch (error: any) {
    console.error(`${WEBHOOK_LOG_PREFIX} Error handling message:`, error.message);
    await db.logs.add({
      user_id: user.id,
      level: 'error',
      message: `Message handling error: ${error.message}`,
      meta: { messageId: message.id }
    });
  }
}
