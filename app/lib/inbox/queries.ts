import { saveComment, createDirectMessage, markCommentProcessed } from '@/lib/supabase/queries'

// Lightweight inbox helpers that reuse existing tables (`comments`, `direct_messages`).
// These present a small, stable API (`upsertConversation`, `insertMessage`) while
// honoring the project constraint of not adding new tables.

export async function upsertConversation(supabase: any, opts: {
  workspaceId: string
  agentId?: string | null
  platform: 'facebook' | 'instagram' | 'website'
  externalThreadId?: string | null
  customerId?: string | null
  customerName?: string | null
  text?: string | null
}) {
  const { workspaceId, agentId, platform, externalThreadId, customerId, customerName, text } = opts

  // Public comment platforms -> persist into `comments`
  if (platform === 'website') {
    const payload: any = {
      platform: 'website',
      platform_comment_id: externalThreadId || null,
      author_id: customerId || null,
      author_name: customerName || null,
      text: text || null,
      agent_id: agentId || null,
    }

    const saved = await saveComment(payload as any)
    if (!saved) throw new Error('Failed to persist comment')
    return { id: saved.id, type: 'comment', data: saved }
  }

  // Meta platforms (facebook / instagram) - model as direct messages for inbox
  const payload: any = {
    agent_id: agentId || null,
    recipient_id: customerId || customerName || null,
    recipient_name: customerName || customerId || null,
    content: text || null,
    platform: platform === 'facebook' ? 'facebook_messenger' : 'instagram',
    external_thread_id: externalThreadId || null,
    status: 'received',
  }

  const res = await createDirectMessage(workspaceId, payload)
  if (!res || !res.data) throw res.error || new Error('Failed to persist direct message')
  return { id: res.data.id, type: 'dm', data: res.data }
}

export async function insertMessage(supabase: any, opts: {
  workspaceId: string
  conversation: { id: string; type: 'dm' | 'comment' }
  sender: 'customer' | 'agent' | 'bot'
  content: string
  externalMessageId?: string | null
  platform?: 'facebook' | 'instagram' | 'website'
}) {
  const { workspaceId, conversation, sender, content, externalMessageId, platform } = opts

  if (conversation.type === 'comment') {
    // For public comments we store the original customer comment via `comments`.
    // If this is a bot reply, update the comment with bot_reply fields.
    if (sender === 'bot') {
      const updated = await markCommentProcessed(conversation.id, { reply: content, publicReplyId: externalMessageId || null })
      if (!updated) throw new Error('Failed to persist bot public reply')
      return updated
    }

    // customer/agent messages for comments: no-op (the original `saveComment` should have created the row)
    return { id: conversation.id }
  }

  // For DMs, create a new direct_messages row for each message
  const payload: any = {
    agent_id: null,
    recipient_id: null,
    recipient_name: null,
    content,
    platform: platform === 'facebook' ? 'facebook_messenger' : platform === 'instagram' ? 'instagram' : 'unknown',
    external_message_id: externalMessageId || null,
    status: sender === 'bot' || sender === 'agent' ? 'sent' : 'received',
  }

  const res = await createDirectMessage(workspaceId, payload)
  if (!res || !res.data) throw res.error || new Error('Failed to persist DM message')
  return res.data
}

export default {
  upsertConversation,
  insertMessage,
}
