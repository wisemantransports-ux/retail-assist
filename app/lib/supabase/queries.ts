
import { createServerClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { upsertConversation, insertMessage } from '@/lib/inbox/queries'
import type {
	User,
	Workspace,
	WorkspaceMember,
	WorkspaceInvite,
	Agent,
	Comment,
	DirectMessage,
	AutomationRule,
	Invoice,
	SubscriptionStatus,
} from '../types/database'

// Centralized Supabase query helpers used by server routes.
// These functions are strongly typed to match the frontend expectations
// (see `app/lib/types/database.ts`). Use `createAdminSupabaseClient()` for
// privileged writes and `createServerClient()` for user-scoped reads when
// appropriate.

const admin = () => createAdminSupabaseClient()
const anon = () => createServerClient()

// Resolve a provided id which may be either the internal `users.id` or
// the Supabase Auth UID (auth.users.id stored in `users.auth_uid`).
// Returns the internal `users.id` (creating a lightweight users row if
// none exists when `createIfMissing` is true).
export async function resolveUserId(candidateId: string | null | undefined, createIfMissing = true) {
	if (!candidateId) return null
	const db = admin()

	// 1) Try exact match on internal id
	const { data: byId } = await db.from('users').select('id').eq('id', candidateId).maybeSingle()
	if (byId && (byId as any).id) return (byId as any).id

	// 2) Try match on auth_uid
	const { data: byAuth } = await db.from('users').select('id').eq('auth_uid', candidateId).maybeSingle()
	if (byAuth && (byAuth as any).id) return (byAuth as any).id

	if (!createIfMissing) return null

	// Delegate to centralized ensure function that creates/upserts a full users row
	try {
		const { id } = await ensureInternalUser(candidateId)
		return id || null
	} catch (e: any) {
		console.error('[resolveUserId] failed to ensure internal user:', e)
		return null
	}
}

// Ensure there's a full internal `users` row for the given candidate id.
// Accepts either an internal users.id or a Supabase auth UID. Returns
// an object containing the internal `id` when successful or `{ id: null }`.
export async function ensureInternalUser(candidateId: string | null | undefined): Promise<{ id: string | null }> {
    if (!candidateId) return { id: null }
    const db = admin()

    // If candidateId already matches an internal id, return it
    const { data: byId } = await db.from('users').select('id').eq('id', candidateId).maybeSingle()
    if (byId && (byId as any).id) return { id: (byId as any).id }

    // If there's already a user with auth_uid, return it
    const { data: byAuth } = await db.from('users').select('id').eq('auth_uid', candidateId).maybeSingle()
    if (byAuth && (byAuth as any).id) return { id: (byAuth as any).id }

    // Create/upsert a full user record with sensible defaults
    const now = new Date().toISOString()
    const record: any = {
        auth_uid: candidateId,
        email: '',
        role: 'user',
        plan_type: 'starter',
        payment_status: 'unpaid',
        subscription_status: 'pending',
        created_at: now,
        updated_at: now,
    }

    try {
        const { data, error } = await db.from('users').upsert(record, { onConflict: 'auth_uid' }).select('id').maybeSingle()
        if (error) {
            console.error('[ensureInternalUser] upsert error:', error)
        }
        if (data && (data as any).id) return { id: (data as any).id }

        // Final fallback: select by auth_uid
        const { data: sel } = await db.from('users').select('id').eq('auth_uid', candidateId).maybeSingle()
        if (sel && (sel as any).id) return { id: (sel as any).id }
    } catch (e: any) {
        console.error('[ensureInternalUser] unexpected error:', e)
    }

    return { id: null }
}

// -----------------------------
// Users / Profiles
// -----------------------------
export async function getUserProfile(userId: string) {
	const db = admin()
	const { data, error } = await db.from('users').select('*').eq('id', userId).limit(1).maybeSingle()
	return { data: data as User | null, error }
}

export async function upsertUserProfile(profile: Partial<User> & { id: string }) {
	const db = admin()
	const { data, error } = await db.from('users').upsert(profile).select().limit(1).maybeSingle()
	return { data: data as User | null, error }
}

export async function createUserProfile(profile: Partial<User> & { email: string }) {
	const db = admin()
	const now = new Date().toISOString()
	const record = { ...profile, created_at: now, updated_at: now }
	const { data, error } = await db.from('users').insert(record).select().limit(1).maybeSingle()
	return { data: data as User | null, error }
}

export async function findUserByEmail(email: string) {
	const db = anon()
	const { data, error } = await db.from('users').select('*').eq('email', email).limit(1).maybeSingle()
	return { data: data as User | null, error }
}

export async function getCurrentUser() {
	const db = anon()
	try {
		const { data, error } = await db.auth.getUser()
		if (error) return null
		return (data as any)?.user || null
	} catch (e) {
		return null
	}
}

// -----------------------------
// Workspaces & Members
// -----------------------------
export async function createWorkspace(payload: { owner_id: string; name: string; description?: string }) {
	const db = admin()
	const now = new Date().toISOString()
	// owner_id may be an auth UID or an internal users.id — resolve to internal id
	const owner_internal = await resolveUserId(payload.owner_id)
	const record = { ...payload, owner_id: owner_internal || payload.owner_id, created_at: now, updated_at: now }
	const { data, error } = await db.from('workspaces').insert(record).select().limit(1).maybeSingle()
	return { data: data as Workspace | null, error }
}

export async function getWorkspaceById(workspaceId: string) {
	const db = anon()
	const { data, error } = await db.from('workspaces').select('*').eq('id', workspaceId).limit(1).maybeSingle()
	return { data: data as Workspace | null, error }
}

export async function inviteMember(workspace_id: string, email: string, role: WorkspaceMember['role'] = 'staff', inviter_id?: string) {
	const db = admin()
	const token = `invite_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
	const now = new Date().toISOString()
	const invite: Partial<WorkspaceInvite> = {
		workspace_id,
		email,
		role,
		token,
		accepted: false,
		expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days
		created_at: now,
		created_by: inviter_id || null,
	}

	const { data, error } = await db.from('workspace_invites').insert(invite).select().limit(1).maybeSingle()
	return { data: data as WorkspaceInvite | null, error }
}

export async function acceptInvite(token: string, userId: string) {
	const db = admin()
	// Find invite
	const { data: invite, error: inviteErr } = await db.from('workspace_invites').select('*').eq('token', token).limit(1).maybeSingle()
	if (inviteErr) return { error: inviteErr }
	if (!invite) return { error: 'Invite not found' }
	if (invite.accepted) return { error: 'Invite already accepted' }
	if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: 'Invite expired' }

	// Resolve provided userId (may be auth UID) to internal users.id
	const internalUserId = await resolveUserId(userId)
	// Create membership
	const member = {
		workspace_id: invite.workspace_id,
		user_id: internalUserId || userId,
		role: invite.role || 'staff',
		invited_by: invite.created_by || null,
		invited_at: invite.created_at || new Date().toISOString(),
		accepted_at: new Date().toISOString(),
		created_at: new Date().toISOString(),
	}

	const { data: created, error: createErr } = await db.from('workspace_members').insert(member).select().limit(1).maybeSingle()
	if (createErr) return { error: createErr }

	// Mark invite accepted
	const { data: updatedInvite, error: updateErr } = await db.from('workspace_invites').update({ accepted: true, accepted_by: internalUserId || userId, accepted_at: new Date().toISOString() }).eq('id', invite.id).select().limit(1).maybeSingle()
	if (updateErr) return { error: updateErr }

	return { data: { member: created, invite: updatedInvite } }
}

export async function updateMemberRole(workspace_id: string, member_id: string, role: WorkspaceMember['role'], actor_id?: string) {
	const db = admin()
	const { data, error } = await db.from('workspace_members').update({ role, updated_at: new Date().toISOString() }).match({ id: member_id, workspace_id }).select().limit(1).maybeSingle()
	return { data: data as WorkspaceMember | null, error }
}

export async function removeMember(workspace_id: string, member_id: string, actor_id?: string) {
	const db = admin()
	const { error } = await db.from('workspace_members').delete().match({ id: member_id, workspace_id })
	return { success: !error, error }
}

export async function listWorkspaceMembers(workspace_id: string) {
	const db = anon()
	const { data, error } = await db.from('workspace_members').select('*, users(*)').eq('workspace_id', workspace_id)
	return { data: data as Array<WorkspaceMember & { user?: User }> | null, error }
}

export async function listWorkspacesForUser(user_id: string) {
	const db = anon()
	// Resolve auth UID -> internal users.id (create lightweight user if missing)
	const internalUserId = await resolveUserId(user_id)
	const effectiveUserId = internalUserId || user_id
	// Workspaces where user is a member or owner
	const { data: ownerWorkspaces, error: ownerErr } = await db.from('workspaces').select('*').eq('owner_id', effectiveUserId)
	const { data: memberRows, error: memberErr } = await db.from('workspace_members').select('workspace_id').eq('user_id', effectiveUserId)
	const memberWorkspaceIds = (memberRows || []).map((r: any) => r.workspace_id)
	let memberWorkspaces: any[] = []
	if (memberWorkspaceIds.length > 0) {
		const { data } = await db.from('workspaces').select('*').in('id', memberWorkspaceIds)
		memberWorkspaces = data || []
	}
	return { data: [...(ownerWorkspaces || []), ...memberWorkspaces], error: ownerErr || memberErr }
}

// -----------------------------
// Agents
// -----------------------------
export async function createAgent(workspace_id: string, payload: Partial<Agent>) {
	const db = admin()
	const now = new Date().toISOString()
	const record = { ...payload, workspace_id, created_at: now, updated_at: now }
	const { data, error } = await db.from('agents').insert(record).select().limit(1).maybeSingle()
	return { data: data as Agent | null, error }
}

export async function getAgentById(agentId: string) {
	const db = anon()
	const { data, error } = await db.from('agents').select('*').eq('id', agentId).limit(1).maybeSingle()
	// Return the agent record directly to match call-sites that expect an Agent or null
	return data as Agent | null
}

export async function listAgentsForWorkspace(workspace_id: string) {
	const db = anon()
	const { data, error } = await db.from('agents').select('*').eq('workspace_id', workspace_id)
	return { data: data as Agent[] | null, error }
}

// -----------------------------
// Comments & Direct Messages
// -----------------------------
export async function saveComment(agentIdOrPayload: string | Partial<Comment>, maybePayload?: Partial<Comment>) {
	const db = admin()
	const now = new Date().toISOString()
	let record: any
	if (typeof agentIdOrPayload === 'string') {
		record = { ...(maybePayload || {}), agent_id: agentIdOrPayload, created_at: now, updated_at: now }
	} else {
		record = { ...agentIdOrPayload, created_at: now, updated_at: now }
	}
	const { data, error } = await db.from('comments').insert(record).select().limit(1).maybeSingle()
	if (!data) return null
	return data as Comment
}

export async function createDirectMessage(workspace_id: string, payload: any) {
	const db = admin()
	const now = new Date().toISOString()
	const record = { ...payload, workspace_id, created_at: now, updated_at: now }
	const { data, error } = await db.from('direct_messages').insert(record).select().limit(1).maybeSingle()
	if (error || !data) return { data: null, error }
	// Return an object that includes both the raw record and wrapper fields so callers
	// can destructure `{ data, error }` or use the returned object directly.
	const out: any = { ...data, data, error: null }
	return out
}

export async function listDirectMessages(workspace_id: string, agent_id?: string) {
	const db = anon()
	let q = db.from('direct_messages').select('*').eq('workspace_id', workspace_id).order('created_at', { ascending: false })
	if (agent_id) q = q.eq('agent_id', agent_id)
	const { data, error } = await q
	return { data: data as DirectMessage[] | null, error }
}

// -----------------------------
// Inbox / Conversation helpers (canonical inbox API)
// -----------------------------

export async function listInboxConversations(supabaseClient: any, workspaceId: string) {
	// supabaseClient should be created via createServerClient() so RLS applies
	if (!supabaseClient) throw new Error('Supabase client required')

	// Verify requestor membership in workspace
	// Resolve current user from session (auth.uid) via server client
	const { data: userData } = await supabaseClient.auth.getUser()
	const authUser = (userData as any)?.user
	if (!authUser) throw new Error('Not authenticated')

	// Confirm membership or ownership
	const { data: member } = await anon().from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', await resolveUserId(authUser.id, false)).limit(1).maybeSingle()
	const { data: owner } = await anon().from('workspaces').select('id').eq('id', workspaceId).eq('owner_id', await resolveUserId(authUser.id, false)).limit(1).maybeSingle()
	if (!member && !owner) throw new Error('Forbidden')

	// Pull messages for workspace and group in-memory by conversation key
	const db = supabaseClient
	const { data, error } = await db.from('direct_messages').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
	if (error) throw error
	const rows = data || []

	// Group by derived conversation id: `${platform}:${external_user_id}:${workspace_id}`
	const groups: Record<string, any> = {}
	for (const r of rows) {
		// normalize platform mapping
		let p = (r.platform || '').toLowerCase()
		if (p === 'facebook_messenger') p = 'facebook'
		if (p === 'instagram') p = 'instagram'
		if (p === 'website') p = 'website'

		const externalUserId = r.recipient_id || r.recipient_name || 'anon'
		const key = `${p}:${externalUserId}:${workspaceId}`
		if (!groups[key]) groups[key] = { platform: p, externalUserId, workspaceId, lastMessage: r.content || '', lastMessageAt: r.created_at, unreadCount: 0 }
		// update last message/time if this row is newer
		if (!groups[key].lastMessageAt || new Date(r.created_at) > new Date(groups[key].lastMessageAt)) {
			groups[key].lastMessage = r.content || ''
			groups[key].lastMessageAt = r.created_at
		}
		if (r.status === 'received') groups[key].unreadCount = (groups[key].unreadCount || 0) + 1
	}

	// Convert groups to array and order by lastMessageAt desc
	const out = Object.keys(groups).map((k) => ({ conversationId: k, platform: groups[k].platform, externalUserId: groups[k].externalUserId, lastMessage: groups[k].lastMessage, lastMessageAt: groups[k].lastMessageAt, unreadCount: groups[k].unreadCount }))
	out.sort((a: any, b: any) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
	return out
}

export async function listConversationMessages(supabaseClient: any, conversationId: string) {
	if (!supabaseClient) throw new Error('Supabase client required')
	if (!conversationId) throw new Error('conversationId required')

	// conversationId format: `${platform}:${external_user_id}:${workspace_id}`
	const parts = conversationId.split(':')
	if (parts.length < 3) throw new Error('Invalid conversationId')
	const platform = parts[0]
	const externalUserId = parts[1]
	const workspaceId = parts.slice(2).join(':')

	// Verify membership
	const { data: userData } = await supabaseClient.auth.getUser()
	const authUser = (userData as any)?.user
	if (!authUser) throw new Error('Not authenticated')
	const internalId = await resolveUserId(authUser.id, false)
	const { data: member } = await anon().from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', internalId).limit(1).maybeSingle()
	const { data: owner } = await anon().from('workspaces').select('id').eq('id', workspaceId).eq('owner_id', internalId).limit(1).maybeSingle()
	if (!member && !owner) throw new Error('Forbidden')

	const db = supabaseClient
	const messages: any[] = []

	// Fetch direct_messages for this workspace + recipient
	let dmPlatform = platform
	if (platform === 'facebook') dmPlatform = 'facebook_messenger'
	if (platform === 'instagram') dmPlatform = 'instagram'
	const { data: dms, error: dmErr } = await db.from('direct_messages').select('*').eq('workspace_id', workspaceId).eq('recipient_id', externalUserId).eq('platform', dmPlatform).order('created_at', { ascending: true })
	if (dmErr) throw dmErr
	for (const d of (dms || [])) {
		let sender: 'customer' | 'bot' | 'agent' = 'customer'
		if (d.status === 'sent') {
			if (d.agent_id) sender = 'agent'
			else sender = 'bot'
		}
		messages.push({ id: d.id, sender, content: d.content || d.message || '', platform: platform, createdAt: d.created_at })
	}

	// If platform is facebook/instagram, also include comment threads authored by this externalUserId
	if (platform === 'facebook' || platform === 'instagram') {
		const { data: comments, error: cErr } = await db.from('comments').select('*').eq('workspace_id', workspaceId).eq('author_id', externalUserId).eq('platform', platform).order('created_at', { ascending: true })
		if (cErr) throw cErr
		for (const c of (comments || [])) {
			const content = c.text || c.content || c.message || ''
			messages.push({ id: c.id, sender: 'customer', content, platform: platform, createdAt: c.created_at })
			if (c.bot_reply) {
				messages.push({ id: `${c.id}:bot`, sender: 'bot', content: c.bot_reply, platform: platform, createdAt: c.processed_at || c.updated_at || new Date().toISOString() })
			}
		}
	}

	// Sort by createdAt ascending to return chronological
	messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
	return messages
}

// -----------------------------
// Agent Replies & Read Receipts
// -----------------------------

export async function sendAgentReply(supabaseClient: any, conversationId: string, content: string) {
	if (!supabaseClient) throw new Error('Supabase client required')
	if (!conversationId || !content) throw new Error('conversationId and content required')

	// Parse conversationId: ${platform}:${externalUserId}:${workspaceId}
	const parts = conversationId.split(':')
	if (parts.length < 3) throw new Error('Invalid conversationId')
	const platform = parts[0]
	const externalUserId = parts[1]
	const workspaceId = parts.slice(2).join(':')

	// Verify membership (already done in endpoint, but double-check)
	const { data: userData } = await supabaseClient.auth.getUser()
	const authUser = (userData as any)?.user
	if (!authUser) throw new Error('Not authenticated')
	const internalId = await resolveUserId(authUser.id, false)
	const { data: member } = await anon().from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', internalId).limit(1).maybeSingle()
	const { data: owner } = await anon().from('workspaces').select('id').eq('id', workspaceId).eq('owner_id', internalId).limit(1).maybeSingle()
	if (!member && !owner) throw new Error('Forbidden')

	// Persist agent message using inbox helpers
	const conv = await upsertConversation(supabaseClient, {
		workspaceId,
		agentId: null, // agent replies don't need specific agent_id here
		platform: platform as 'facebook' | 'instagram' | 'website',
		externalThreadId: null,
		customerId: externalUserId,
		customerName: null,
		text: null,
	})

	await insertMessage(supabaseClient, {
		workspaceId,
		conversation: { id: conv.id, type: conv.type as 'dm' | 'comment' },
		sender: 'agent',
		content,
		externalMessageId: null,
		platform: platform as 'facebook' | 'instagram' | 'website',
	})

	// Send externally if Meta platform
	if (platform === 'facebook' || platform === 'instagram') {
		// Get access token from integrations
		const { data: integration } = await anon().from('integrations').select('access_token').eq('workspace_id', workspaceId).eq('platform', platform).limit(1).maybeSingle()
		if (!integration?.access_token) throw new Error(`No access token for ${platform}`)

		// Reuse existing Meta helper (same API for Facebook and Instagram)
		const { fbSendDM } = await import('@/lib/facebook')
		const sendResult = await fbSendDM(externalUserId, content, integration.access_token)
		if (!sendResult.success) throw new Error(`Failed to send ${platform} message: ${sendResult.error}`)
	}
	// For website, no external send

	// Log message usage
	await logMessage(workspaceId, {
		direction: 'outbound',
		platform,
		recipient_id: externalUserId,
		content,
		user_id: internalId,
	})

	return { ok: true }
}

export async function markConversationMessagesAsRead(supabaseClient: any, conversationId: string) {
	if (!supabaseClient) throw new Error('Supabase client required')
	if (!conversationId) throw new Error('conversationId required')

	// Parse conversationId
	const parts = conversationId.split(':')
	if (parts.length < 3) throw new Error('Invalid conversationId')
	const platform = parts[0]
	const externalUserId = parts[1]
	const workspaceId = parts.slice(2).join(':')

	// Verify membership
	const { data: userData } = await supabaseClient.auth.getUser()
	const authUser = (userData as any)?.user
	if (!authUser) throw new Error('Not authenticated')
	const internalId = await resolveUserId(authUser.id, false)
	const { data: member } = await anon().from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', internalId).limit(1).maybeSingle()
	const { data: owner } = await anon().from('workspaces').select('id').eq('id', workspaceId).eq('owner_id', internalId).limit(1).maybeSingle()
	if (!member && !owner) throw new Error('Forbidden')

	// Update direct_messages: set status='read' where workspace_id, recipient_id, status='received'
	let dmPlatform = platform
	if (platform === 'facebook') dmPlatform = 'facebook_messenger'
	if (platform === 'instagram') dmPlatform = 'instagram'
	const { error } = await supabaseClient.from('direct_messages').update({ status: 'read' }).eq('workspace_id', workspaceId).eq('recipient_id', externalUserId).eq('platform', dmPlatform).eq('status', 'received')
	if (error) throw error

	return { ok: true }
}

// -----------------------------
// Payments / Mobile Money / PayPal
// -----------------------------
export async function createPayment(paymentOrWorkspaceId: any, maybeUserId?: string | null, maybeAmount?: number, maybeMethodOrExtra?: any, maybeExtraMeta?: any) {
	const db = admin()
	const now = new Date().toISOString()
	let record: any
	if (typeof paymentOrWorkspaceId === 'object') {
		const payment = paymentOrWorkspaceId
		// If payment contains a user_id that may be an auth UID, resolve it
		if (payment.user_id) {
			payment.user_id = await resolveUserId(payment.user_id) || payment.user_id
		}
		record = { ...payment, currency: payment.currency || 'BWP', status: payment.status || 'pending', created_at: now }
	} else {
		// positional args: workspaceId, userId, amount, method, extraMeta
		const resolvedUserId = maybeUserId ? await resolveUserId(maybeUserId) : null
		record = {
			workspace_id: paymentOrWorkspaceId,
			user_id: resolvedUserId || maybeUserId || null,
			amount: maybeAmount || 0,
			currency: (maybeExtraMeta && maybeExtraMeta.currency) || 'BWP',
			method: typeof maybeMethodOrExtra === 'string' ? maybeMethodOrExtra : (maybeMethodOrExtra?.method || 'paypal'),
			status: (maybeExtraMeta && maybeExtraMeta.status) || 'pending',
			provider: maybeExtraMeta?.provider || null,
			provider_reference: maybeExtraMeta?.provider_reference || null,
			metadata: maybeExtraMeta || {},
			created_at: now,
		}
	}
	const { data, error } = await db.from('payments').insert(record).select().limit(1).maybeSingle()
	return { data: data || null, error }
}

export async function getPaymentsForWorkspace(workspace_id: string) {
	const db = anon()
	const { data, error } = await db.from('payments').select('*').eq('workspace_id', workspace_id).order('created_at', { ascending: false })
	return { data: data as any[] | null, error }
}

export async function getPaymentById(paymentId: string) {
	const db = anon()
	const { data, error } = await db.from('payments').select('*').eq('id', paymentId).limit(1).maybeSingle()
	return { data: data || null, error }
}

export async function approveMobileMoneyPayment(paymentId: string, adminId?: string, notesOrMeta?: string | any) {
	const db = admin()
	const payload: any = { status: 'completed', updated_at: new Date().toISOString() }
	if (typeof notesOrMeta === 'string') {
		payload.provider_reference = notesOrMeta
	} else if (typeof notesOrMeta === 'object' && notesOrMeta !== null) {
		// attach metadata and optional provider_reference
		if (notesOrMeta.provider_reference) payload.provider_reference = notesOrMeta.provider_reference
		payload.metadata = { ...(notesOrMeta.metadata || {}), ...notesOrMeta }
	}
	const { data, error } = await db.from('payments').update(payload).match({ id: paymentId, method: 'mobile_money' }).select().limit(1).maybeSingle()
	return { data: data as any | null, error }
}

export async function rejectMobileMoneyPayment(paymentId: string, adminId?: string, reason?: string) {
	const db = admin()
	const { data, error } = await db.from('payments').update({ status: 'failed', provider_reference: reason, updated_at: new Date().toISOString() }).match({ id: paymentId, method: 'mobile_money' }).select().limit(1).maybeSingle()
	return { data: data as any | null, error }
}

export async function updatePaymentStatus(paymentId: string, status: string, meta?: any) {
	const db = admin()
	const { data, error } = await db.from('payments').update({ status, metadata: meta, updated_at: new Date().toISOString() }).eq('id', paymentId).select().limit(1).maybeSingle()
	return { data: data || null, error }
}

export async function recordPaymentSuccess(paymentId: string, metadata?: any) {
	// Mark a payment as completed and attach metadata
	try {
		const res = await updatePaymentStatus(paymentId, 'completed', metadata)
		return res
	} catch (e: any) {
		return { error: e?.message || e }
	}
}

// -----------------------------
// Automation Rules
// -----------------------------
export async function createAutomationRule(workspace_id: string, agent_id: string, payload: Partial<AutomationRule>) {
	const db = admin()
	const now = new Date().toISOString()
	const record = { ...payload, workspace_id, agent_id, created_at: now, updated_at: now }
	const { data, error } = await db.from('automation_rules').insert(record).select().limit(1).maybeSingle()
	return { data: data as AutomationRule | null, error }
}

export async function updateAutomationRule(ruleId: string, payload: Partial<AutomationRule>) {
	const db = admin()
	const { data, error } = await db.from('automation_rules').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', ruleId).select().limit(1).maybeSingle()
	return { data: data as AutomationRule | null, error }
}

export async function deleteAutomationRule(ruleId: string) {
	const db = admin()
	const { error } = await db.from('automation_rules').delete().eq('id', ruleId)
	return { success: !error, error }
}

export async function listAutomationRules(workspace_id: string, agent_id?: string) {
	const db = anon()
	let query = db.from('automation_rules').select('*').eq('workspace_id', workspace_id)
	if (agent_id) query = query.eq('agent_id', agent_id)
	const { data, error } = await query
	return { data: data as AutomationRule[] | null, error }
}

export async function getAutomationRules(workspace_id: string, agent_id?: string, includeDisabled?: boolean) {
	const res = await listAutomationRules(workspace_id, agent_id)
	if (!res.data) return []
	if (includeDisabled) return res.data
	return (res.data || []).filter((r: any) => r.enabled)
}

export async function hasAlreadyReplied(commentIdentifier: string) {
	// Check comments table for processed flag or bot_reply for given platform_comment_id
	try {
		const db = anon()
		const { data } = await db.from('comments').select('*').or(`platform_comment_id.eq.${commentIdentifier},id.eq.${commentIdentifier}`).limit(1).maybeSingle()
		if (!data) return false
		return Boolean(data.processed || data.bot_reply || data.bot_reply_id)
	} catch (e) {
		return false
	}
}

export async function logAutomationAction(payload: any) {
	// Persist automation actions to audit_logs for now
	const { workspace_id, agent_id, comment_id, action, metadata } = payload || {}
	return createAuditLog(workspace_id, null, action || 'automated_action', 'rule', comment_id || null, { agent_id, ...metadata })
}

export async function logMessage(workspace_id: string, data: any) {
	const db = admin()
	try {
		const now = new Date().toISOString()
		// Resolve user_id in the payload if present (auth UID -> internal id)
		let userIdResolved = null
		if (data?.user_id) userIdResolved = await resolveUserId(data.user_id)
		const record = { workspace_id, ...data, user_id: userIdResolved || data.user_id || null, created_at: now }
		const { data: inserted, error } = await db.from('message_logs').insert(record).select().limit(1).maybeSingle()
		if (!error) return { data: inserted || null }
	} catch (e) {
		// fallback
	}
	const fallbackUser = data?.user_id ? await resolveUserId(data.user_id) : null
	return createAuditLog(workspace_id, fallbackUser || null, 'logged_message', 'agent', data.agent_id || null, data)
}

export async function insertSystemLog(level: string, workspaceId?: string | null, userId?: string | null, context?: string, message?: string, metadata?: any, stackTrace?: string | null) {
	// Store system-level logs in audit_logs table with resource_type 'integration'
	return createAuditLog(workspaceId || null, userId || null, level, 'integration', null, { context, message, metadata, stackTrace })
}

export async function markCommentProcessed(commentId: string, updates?: { reply?: string; publicReplyId?: string } | string, publicReplyId?: string) {
	const db = admin()
	const payload: any = { processed: true, processed_at: new Date().toISOString() }
	if (typeof updates === 'string') {
		payload.bot_reply = updates
		if (publicReplyId) payload.bot_reply_id = publicReplyId
	} else {
		if (updates?.reply) payload.bot_reply = updates.reply
		if (updates?.publicReplyId) payload.bot_reply_id = updates.publicReplyId
		if (publicReplyId) payload.bot_reply_id = publicReplyId
	}
	const { data, error } = await db.from('comments').update(payload).eq('id', commentId).select().limit(1).maybeSingle()
	if (!data) return null
	return data
}

// -----------------------------
// Subscriptions & Billing
// -----------------------------
export async function createSubscription(a: any, maybePayload?: any) {
	const db = admin()
	const now = new Date().toISOString()
	let record: any
	if (typeof a === 'object') {
		const payload = a
		record = { workspace_id: payload.workspace_id, plan_id: payload.plan_id, status: payload.status || 'active', provider: payload.provider || null, provider_subscription_id: payload.provider_subscription_id || null, metadata: payload.metadata || null, created_at: now, updated_at: now }
	} else {
		const workspace_id = a
		const payload = maybePayload || {}
		record = { workspace_id, plan_id: payload.plan_id, status: payload.status || 'active', provider: payload.provider || null, provider_subscription_id: payload.provider_subscription_id || null, metadata: payload.metadata || null, created_at: now, updated_at: now }
	}
	const { data, error } = await db.from('subscriptions').insert(record).select().limit(1).maybeSingle()
	return { data: data || null, error }
}

// -----------------------------
// Plans / Billing helpers
// -----------------------------
export async function getAllPlans() {
	const db = anon()
	// Try to read from a `plans` table if present, otherwise return a static list
	try {
		const { data, error } = await db.from('plans').select('*')
		if (!error && data) return { data }
	} catch (e) {
		// ignore
	}
	const staticPlans = [
		{
			id: 'starter',
			name: 'starter',
			display_name: 'Starter',
			price_monthly: 22,
			price_yearly: 220,
			included_monthly_usage: 1000,
			is_active: true,
			sort_order: 10,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		},
		{
			id: 'pro',
			name: 'pro',
			display_name: 'Pro',
			price_monthly: 45,
			price_yearly: 450,
			included_monthly_usage: 5000,
			is_active: true,
			sort_order: 20,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		},
		{
			id: 'enterprise',
			name: 'enterprise',
			display_name: 'Enterprise',
			price_monthly: 75,
			price_yearly: 750,
			included_monthly_usage: 20000,
			is_active: true,
			sort_order: 30,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		},
	]
	return { data: staticPlans, error: null }
}

export async function getPlanById(planId: string) {
	const plans = await getAllPlans()
	const found = (plans.data || []).find((p: any) => p.id === planId) || null
	return { data: found, error: null }
}

export async function getBillingPaymentHistory(workspace_id: string) {
	// reuse payments query
	return getPaymentsForWorkspace(workspace_id)
}

export async function getPendingMobileMoneyPayments(workspace_id: string) {
	const db = anon()
	const { data, error } = await db.from('payments').select('*').eq('workspace_id', workspace_id).eq('method', 'mobile_money').eq('status', 'pending')
	return { data: data || [], error }
}

export async function saveMobileMoneyPayment(workspaceIdOrData: any, userId?: string, phoneNumber?: string, amount?: number, referenceCode?: string) {
	if (typeof workspaceIdOrData === 'object') {
		return createPayment(workspaceIdOrData)
	}
	return createPayment({ workspace_id: workspaceIdOrData, user_id: userId || null, amount: amount || 0, currency: 'BWP', method: 'mobile_money', provider_reference: referenceCode || null, metadata: { phoneNumber } })
}

export async function createMobileMoneyPaymentBilling(
	a: string | { workspace_id: string; user_id?: string | null; amount: number; currency?: string; provider?: string; phoneNumber?: string; metadata?: any },
	workspaceId?: string,
	phoneNumber?: string,
	amount?: number,
	referenceCode?: string,
	provider?: string
) {
	if (typeof a === 'object') {
		const opts = a
		const { workspace_id, user_id, amount: amt, currency = 'BWP', provider: prov = 'mobile_money', phoneNumber: phone, metadata } = opts
		const payment = {
			workspace_id,
			user_id: user_id || null,
			amount: amt,
			currency: currency,
			method: 'mobile_money',
			status: 'pending',
			provider: prov || 'mobile_money',
			provider_reference: null,
			metadata: { phoneNumber: phone, ...metadata },
		}
		return createPayment(payment)
	}

	// Called with positional args: subscriptionId, workspaceId, phoneNumber, amount, referenceCode, provider
	const subscriptionId = a
	const payment = {
		workspace_id: workspaceId,
		user_id: null,
		amount: amount || 0,
		currency: 'BWP',
		method: 'mobile_money',
		status: 'pending',
		provider: provider || 'mobile_money',
		provider_reference: referenceCode || null,
		metadata: { phoneNumber: phoneNumber || null, subscriptionId },
	}
	return createPayment(payment)
}

export async function confirmMobileMoneyPaymentBilling(paymentId: string, providerReference?: string, markCompleted = true) {
	// Confirm a pending mobile-money payment used for billing flows.
	// Update payment record, optionally mark completed and record billing event.
	try {
		if (markCompleted) {
			const approved = await approveMobileMoneyPayment(paymentId, null, providerReference || undefined)
			if (approved.error) return { error: approved.error }
			// Optionally create a billing event linking to subscription metadata
			const payment = approved.data
			try {
				const workspaceId = payment?.workspace_id
				const amount = payment?.amount
				const provider = payment?.provider || 'mobile_money'
				await recordBillingPayment(payment?.metadata?.subscriptionId || '', workspaceId, amount, payment?.currency || 'BWP', provider, providerReference || null, payment?.metadata || {})
				await recordBillingEvent(workspaceId, 'mobile_money_confirmed', payment?.metadata?.subscriptionId || null, null, { paymentId, providerReference })
			} catch (e) {
				// swallow record errors
			}
			return { data: approved.data }
		}
		// If not marking completed, just update provider_reference
		const updated = await updatePaymentStatus(paymentId, 'created', { provider_reference: providerReference })
		return updated
	} catch (e: any) {
		return { error: e?.message || e }
	}
}

export async function recordBillingPayment(subscriptionId: string, workspaceId: string, amount: number, currency: string, provider: string, providerReference?: string, metadata?: any) {
	// create a payment record and optionally link to subscription
	const res = await createPayment({ workspace_id: workspaceId, amount, currency, method: provider || 'manual', status: 'completed', provider, provider_reference: providerReference || null, metadata: { subscriptionId, ...metadata } })
	return res
}

export async function recordBillingEvent(workspaceId: string, event: string, subscriptionId?: string, userId?: string | undefined, metadata?: any) {
	// Log billing-related event to audit_logs
	return createAuditLog(workspaceId, userId || null, event, 'integration', subscriptionId || null, metadata)
}

export async function updateSubscriptionBilling(subscriptionId: string, statusOrData: string | any) {
	// update subscriptions with flexible payload
	const db = admin()
	if (typeof statusOrData === 'string') {
		return updateSubscriptionStatus(subscriptionId, statusOrData)
	}
	const { data, error } = await db.from('subscriptions').update({ ...statusOrData, updated_at: new Date().toISOString() }).eq('id', subscriptionId).select().limit(1).maybeSingle()
	return { data: data || null, error }
}

export async function getSubscriptionByProviderId(providerOrId: string, idMaybe?: string) {
	const db = anon()
	const id = idMaybe ?? providerOrId
	const provider = idMaybe ? providerOrId : 'paypal'
	const { data, error } = await db.from('subscriptions').select('*').eq('provider', provider).eq('provider_subscription_id', id).limit(1).maybeSingle()
	return data || null
}

export async function getWorkspaceSubscription(workspace_id: string) {
	return getSubscriptionByWorkspace(workspace_id)
}

export async function getSubscriptionByWorkspace(workspace_id: string) {
	const db = anon()
	const { data, error } = await db.from('subscriptions').select('*').eq('workspace_id', workspace_id).limit(1).maybeSingle()
	return { data: data || null, error }
}

export async function getUserSubscription(userId: string) {
	const db = anon()
	// Find workspaces where user is owner or member
	const { data: ownerWorkspaces } = await db.from('workspaces').select('id').eq('owner_id', userId)
	const { data: memberRows } = await db.from('workspace_members').select('workspace_id').eq('user_id', userId)
	const workspaceIds: string[] = []
	const ow = ownerWorkspaces || []
	for (const w of ow as any[]) {
		if (w?.id && !workspaceIds.includes(w.id)) workspaceIds.push(w.id)
	}
	const mr = memberRows || []
	for (const m of mr as any[]) {
		if (m?.workspace_id && !workspaceIds.includes(m.workspace_id)) workspaceIds.push(m.workspace_id)
	}
	const ids = workspaceIds
	if (ids.length === 0) return null
	const { data } = await db.from('subscriptions').select('*').in('workspace_id', ids).limit(1).maybeSingle()
	return data || null
}

export async function updateSubscriptionStatus(subscriptionId: string, statusOrData: SubscriptionStatus | any) {
	const db = admin()
	if (typeof statusOrData === 'string') {
		const { data, error } = await db.from('subscriptions').update({ status: statusOrData, updated_at: new Date().toISOString() }).eq('id', subscriptionId).select().limit(1).maybeSingle()
		return { data: data || null, error }
	}
	const payload = { ...(statusOrData || {}), updated_at: new Date().toISOString() }
	const { data, error } = await db.from('subscriptions').update(payload).eq('id', subscriptionId).select().limit(1).maybeSingle()
	return { data: data || null, error }
}

// -----------------------------
// Audit / Logs
// -----------------------------
export async function createAuditLog(workspace_id: string, user_id: string | null, action: string, resource_type: string, resource_id?: string, changes?: any) {
	const db = admin()
	const now = new Date().toISOString()
	const record = { workspace_id, user_id, action, resource_type, resource_id, changes, created_at: now }
	const { data, error } = await db.from('audit_logs').insert(record).select().limit(1).maybeSingle()
	return { data: data || null, error }
}

export async function listAuditLogs(workspace_id: string, limit = 100) {
	const db = anon()
	const { data, error } = await db.from('audit_logs').select('*').eq('workspace_id', workspace_id).order('created_at', { ascending: false }).limit(limit)
	return { data: data || null, error }
}

export async function createInvoice(payload: Partial<Invoice>) {
	const db = admin()
	const now = new Date().toISOString()
	const record = { ...payload, created_at: payload.created_at || now }
	const { data, error } = await db.from('invoices').insert(record).select().limit(1).maybeSingle()
	return { data: data || null, error }
}

export async function getInvoiceById(invoiceId: string) {
	const db = anon()
	const { data, error } = await db.from('invoices').select('*').eq('id', invoiceId).limit(1).maybeSingle()
	return { data: data || null, error }
}

export default {
	// users
	getUserProfile,
	upsertUserProfile,
  createUserProfile,
  findUserByEmail,
	// workspaces
	createWorkspace,
	getWorkspaceById,
	inviteMember,
	listWorkspaceMembers,
	updateMemberRole,
	removeMember,
  listWorkspacesForUser,
	// agents
	createAgent,
	getAgentById,
	listAgentsForWorkspace,
	// comments/dms
	saveComment,
	createDirectMessage,
  listDirectMessages,
	// payments
	createPayment,
	getPaymentsForWorkspace,
	approveMobileMoneyPayment,
	rejectMobileMoneyPayment,
  getPaymentById,
	// automation
	createAutomationRule,
	updateAutomationRule,
	deleteAutomationRule,
	listAutomationRules,
	getAutomationRules,
	hasAlreadyReplied,
	logAutomationAction,
	logMessage,
	insertSystemLog,
	markCommentProcessed,
	// subscriptions
	createSubscription,
	getSubscriptionByWorkspace,
	updateSubscriptionStatus,
	// audit
	createAuditLog,
  listAuditLogs,
  // invoices
  createInvoice,
  getInvoiceById,
}
