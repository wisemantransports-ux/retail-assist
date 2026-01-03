import { getBrowserSupabaseClient } from './client';
import { getServiceSupabaseClient } from './serverClient';

const IS_MOCK = (process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true');

async function getClient(forWrite = false) {
  if (IS_MOCK) return null;
  try {
    return forWrite ? getServiceSupabaseClient() : getBrowserSupabaseClient();
  } catch (err) {
    return null;
  }
}

export async function getPendingMobileMoneyPayments(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: [] };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: [] };
  const { data, error } = await sb.from('mobile_money_payments').select('*').eq('workspace_id', workspaceId).eq('status', 'pending');
  return { error, data };
}

export async function insertSystemLog(...args: any[]) {
  // Flexible signature to support legacy calls: (entry) or (level, workspaceId, userId, source, message, metadata?, stackTrace?)
  let entry: any;
  if (args.length === 1 && typeof args[0] === 'object') {
    entry = args[0];
  } else {
    const [level, workspaceId, userId, source, message, metadata, stackTrace] = args;
    entry = { level, workspace_id: workspaceId, user_id: userId, source, message, metadata, stack_trace: stackTrace };
  }

  if (IS_MOCK) return { error: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured' };
  const { error } = await sb.from('system_logs').insert({ payload: entry });
  return { error };
}

export async function acceptInvite(token: string, userId: string) {
  if (IS_MOCK) return { error: 'mock-mode', data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: invite, error: inviteErr } = await sb.from('invites').select('*').eq('token', token).limit(1).single();
  if (inviteErr || !invite) return { error: inviteErr || 'invite-not-found', data: null };
  const { data, error } = await sb.from('workspace_members').insert({ workspace_id: invite.workspace_id, user_id: userId, role: invite.role }).select().single();
  return { error, data };
}

export async function getWorkspaceMembers(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: [] };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: [] };
  const { data, error } = await sb.from('workspace_members').select('role, users(id, auth_uid, email, full_name)').eq('workspace_id', workspaceId);
  return { error, data };
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { error, data } = await sb.from('workspace_members').delete().match({ workspace_id: workspaceId, user_id: userId });
  return { error, data };
}

export async function updateMemberRole(workspaceId: string, userId: string, role: string, actorId?: string) {
  // actorId optional for auditing; do not change behavior
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('workspace_members').update({ role }).match({ workspace_id: workspaceId, user_id: userId }).select().single();
  return { error, data };
}

export async function createInvite(workspaceId: string, email: string, role: string, inviterId?: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const token = cryptoRandomToken();
  const payload: any = { workspace_id: workspaceId, email, role, token };
  if (inviterId) payload.inviter_id = inviterId;
  const { data, error } = await sb.from('invites').insert(payload).select().single();
  return { error, data };
}

function cryptoRandomToken(len = 48) {
  return [...Array(len)].map(() => Math.random().toString(36)[2]).join('');
}

export async function getAgent(agentId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('agents').select('*').eq('id', agentId).limit(1).single();
  return { error, data };
}

export async function getAgentById(agentId: string): Promise<any> {
  return getAgent(agentId);
}

export async function updateAgent(agentId: string, data: any) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: updated, error } = await sb.from('agents').update(data).eq('id', agentId).select().single();
  return { error, data: updated };
}

export async function deleteAgent(agentId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('agents').delete().eq('id', agentId);
  return { error, data };
}

export async function getAgentComments(agentId: string) {
  if (IS_MOCK) return { error: null, data: [] };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: [] };
  const { data, error } = await sb.from('comments').select('*').eq('agent_id', agentId).order('created_at', { ascending: false });
  return { error, data };
}

export async function createPayment(...args: any[]) {
  return { error: 'payments-not-enabled', data: null };
}

export async function updatePaymentStatus(...args: any[]) {
  return { error: 'payments-not-enabled', data: null };
}

export async function getSubscription(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('workspaces').select('subscription_status, payment_status, plan_type, plan_limits').eq('id', workspaceId).limit(1).single();
  return { error, data };
}

export async function updateSubscription(workspaceId: string, data: any) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: updated, error } = await sb.from('workspaces').update(data).eq('id', workspaceId).select().single();
  return { error, data: updated };
}

export async function getAutomationRule(ruleId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('automation_rules').select('*').eq('id', ruleId).limit(1).single();
  return { error, data };
}

export async function getAutomationRules(workspaceId: string, agentId?: string, enabledOnly?: boolean) {
  if (IS_MOCK) return [];
  const sb = await getClient();
  if (!sb) return [];
  let q = sb.from('automation_rules').select('*').eq('workspace_id', workspaceId);
  if (agentId) q = q.eq('agent_id', agentId);
  if (enabledOnly) q = q.eq('enabled', true);
  const { data } = await q;
  return data || [];
}

export async function updateAutomationRule(ruleId: string, data: any) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: updated, error } = await sb.from('automation_rules').update(data).eq('id', ruleId).select().single();
  return { error, data: updated };
}

export async function deleteAutomationRule(ruleId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('automation_rules').delete().eq('id', ruleId);
  return { error, data };
}

export async function approveMobileMoneyPayment(...args: any[]) {
  return { error: 'payments-not-enabled', data: null };
}

export async function rejectMobileMoneyPayment(...args: any[]) {
  return { error: 'payments-not-enabled', data: null };
}

export async function confirmMobileMoneyPaymentBilling(...args: any[]) {
  return { error: 'payments-not-enabled', data: null };
}

export async function updateSubscriptionBilling(workspaceId: string, data: any) {
  if (IS_MOCK) return { error: null, data: null };
  // store billing info on workspaces.billing or a dedicated table if present
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: updated, error } = await sb.from('workspaces').update({ payment_status: data.payment_status, plan_limits: data.plan_limits }).eq('id', workspaceId).select().single();
  return { error, data: updated };
}

export async function recordBillingEvent(...args: any[]) {
  // Support legacy call signatures (workspaceId, type, subjectId, userId?, metadata?)
  let event: any;
  if (args.length === 1 && typeof args[0] === 'object') {
    event = args[0];
  } else {
    const [workspaceId, type, subjectId, userId, metadata] = args;
    event = {
      workspace_id: workspaceId,
      type,
      subject_id: subjectId,
      user_id: userId,
      metadata,
    };
  }

  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('billing_events').insert({ payload: event }).select().single();
  return { error, data };
}

export async function saveComment(agentId: string, data?: any) {
  if (IS_MOCK) return { error: null, data: null, id: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null, id: null };
  const payload = { agent_id: agentId, content: data?.content || null, metadata: data?.metadata || {} };
  const { data: inserted, error } = await sb.from('comments').insert(payload).select().single();
  return { error, data: inserted, id: inserted?.id || null };
}

export async function createDirectMessage(workspaceIdOrData: any, data?: any): Promise<any> {
  if (IS_MOCK) return { error: null, data: null, id: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null, id: null };
  const payload = typeof workspaceIdOrData === 'string' ? { workspace_id: workspaceIdOrData, ...data } : workspaceIdOrData;
  const { data: inserted, error } = await sb.from('direct_messages').insert(payload).select().single();
  return { error, data: inserted, id: inserted?.id || null };
}

export async function markCommentProcessed(commentId: string, reply?: string, publicReplyId?: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const updates: any = { processed: true };
  if (typeof reply === 'string') updates.bot_reply = reply;
  if (typeof publicReplyId === 'string') updates.public_reply_id = publicReplyId;
  const { data, error } = await sb.from('comments').update(updates).eq('id', commentId).select().single();
  return { error, data };
}

export async function logMessage(workspaceIdOrData: any, data?: any) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const payload = typeof workspaceIdOrData === 'string' ? { workspace_id: workspaceIdOrData, ...data } : workspaceIdOrData;
  const { data: inserted, error } = await sb.from('messages').insert(payload).select().single();
  return { error, data: inserted };
}

export async function initiateMobileMoneyPayment(data: any) {
  return { error: 'payments-not-enabled', data: null };
}

export async function createMobileMoneyPayment(data: any) {
  return { error: 'payments-not-enabled', data: null };
}

export async function getWorkspaceInvites(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: [] };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: [] };
  const { data, error } = await sb.from('invites').select('*').eq('workspace_id', workspaceId);
  return { error, data };
}

export async function deleteInvite(inviteId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('invites').delete().eq('id', inviteId);
  return { error, data };
}

export async function createWorkspaceInvite(data: any) {
  return createInvite(data.workspace_id, data.email, data.role || 'member');
}

export async function getPayPalSubscription(subscriptionId: string) {
  return { error: 'paypal-disabled', data: null };
}

export async function createPayPalSubscription(data: any) {
  return { error: 'paypal-disabled', data: null };
}

export async function updatePayPalSubscription(subscriptionId: string, data: any) {
  return { error: 'paypal-disabled', data: null };
}

export async function getStripeCustomer(customerId: string) {
  return { error: 'stripe-disabled', data: null };
}

export async function createStripeCustomer(data: any) {
  return { error: 'stripe-disabled', data: null };
}

export async function updateStripeCustomer(customerId: string, data: any) {
  return { error: 'stripe-disabled', data: null };
}

export async function handleStripeWebhook(event: any) {
  return { error: 'stripe-disabled', data: null };
}

export async function handlePayPalWebhook(event: any) {
  return { error: 'paypal-disabled', data: null };
}

export async function getAgents(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: [] };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: [] };
  const { data, error } = await sb.from('agents').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  return { error, data };
}

export async function createAgent(workspaceIdOrData: any, data?: any) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const payload = data || workspaceIdOrData;
  const { data: inserted, error } = await sb.from('agents').insert(payload).select().single();
  return { error, data: inserted };
}

export async function createAuditLog(...args: any[]) {
  return { error: null, data: null };
}

export async function createAutomationRule(...args: any[]) {
  // Support signatures: (data) or (workspaceId, agentId, data) or (workspaceId, data)
  let payload: any;
  if (args.length === 1) {
    payload = args[0];
  } else if (args.length === 2) {
    const [workspaceId, data] = args;
    payload = typeof workspaceId === 'string' && typeof data === 'object' ? { workspace_id: workspaceId, ...data } : data || workspaceId;
  } else {
    const [workspaceId, agentId, data] = args;
    payload = { workspace_id: workspaceId, agent_id: agentId, ...(data || {}) };
  }

  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: inserted, error } = await sb.from('automation_rules').insert(payload).select().single();
  return { error, data: inserted };
}

export async function getAllPlans() {
  return { error: null, data: [] };
}

export async function getPlanById(planId: string) {
  return { error: null, data: null };
}

export async function getWorkspaceBilling(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('workspaces').select('payment_status, plan_type, plan_limits').eq('id', workspaceId).limit(1).single();
  return { error, data };
}

export async function updateWorkspaceBilling(workspaceId: string, data: any) {
  return updateSubscription(workspaceId, data);
}

export async function createPayPalOrder(data: any) {
  return { error: 'paypal-disabled', data: null };
}

export async function capturePayPalOrder(orderId: string) {
  return { error: 'paypal-disabled', data: null };
}

export async function getUser(userId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('users').select('*').eq('id', userId).limit(1).single();
  return { error, data };
}

export async function updateUser(userId: string, data: any) {
  return updateUserInternal(userId, data);
}

async function updateUserInternal(userId: string, data: any) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: updated, error } = await sb.from('users').update(data).eq('id', userId).select().single();
  return { error, data: updated };
}

export async function getWorkspace(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('workspaces').select('*').eq('id', workspaceId).limit(1).single();
  return { error, data };
}

export async function updateWorkspace(workspaceId: string, data: any) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: updated, error } = await sb.from('workspaces').update(data).eq('id', workspaceId).select().single();
  return { error, data: updated };
}

export async function resetPassword(email: string) {
  return { error: 'not-implemented', data: null };
}

export async function getManualApprovals() {
  return { error: null, data: [] };
}

export async function approvePayment(paymentId: string) {
  return { error: 'payments-not-enabled', data: null };
}

export async function getComments(agentId: string) {
  return getAgentComments(agentId);
}

export async function runAutomation(ruleId: string, data: any) {
  return { error: null, data: null };
}

export async function getUserSubscription(userId: string): Promise<any> {
  // derive subscriptions by membership -> workspace
  if (IS_MOCK) return null;
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId);
  if (!data || data.length === 0) return null;
  const wid = data[0].workspace_id;
  const { data: w } = await sb.from('workspaces').select('subscription_status, plan_type').eq('id', wid).limit(1).single();
  return w || null;
}

export async function saveMobileMoneyPayment(...args: any[]) {
  return { error: 'payments-not-enabled', data: null };
}

export async function removeMember(workspaceId: string, userId: string, actorId?: string) {
  // actorId optional for auditing; preserve behavior
  return removeWorkspaceMember(workspaceId, userId);
}

export async function inviteMember(workspaceId: string, email: string, role = 'member', inviterId?: string) {
  // Create an invite record (preserves existing behavior but supports optional inviter)
  return createInvite(workspaceId, email, role, inviterId);
}

export async function addWorkspaceMember(workspaceId: string, userId: string, role = 'member') {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('workspace_members').insert({ workspace_id: workspaceId, user_id: userId, role }).select().single();
  return { error, data };
}

export async function updateSubscriptionStatus(workspaceId: string, statusOrObj: any) {
  // Accept either a status string or an object containing subscription fields
  if (typeof statusOrObj === 'string') {
    return updateSubscription(workspaceId, { subscription_status: statusOrObj });
  }
  return updateSubscription(workspaceId, statusOrObj);
}

export async function getSubscriptionByProviderId(providerId: string): Promise<any> {
  return null;
}

export async function getWorkspaceSubscription(workspaceId: string) {
  return getSubscription(workspaceId);
}

export async function getBillingPaymentHistory(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: [] };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: [] };
  const { data, error } = await sb.from('billing_events').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  return { error, data };
}

export async function recordPaymentSuccess(data: any) {
  return { error: 'payments-not-enabled', data: null };
}

export async function recordBillingPayment(...args: any[]) {
  return { error: 'payments-not-enabled', data: null };
}

export async function createMobileMoneyPaymentBilling(...args: any[]) {
  return { error: 'payments-not-enabled', data: null };
}

export async function createSubscription(data: any) {
  return { error: 'payments-not-enabled', data: null };
}

export async function getCurrentUser() {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.auth.getUser();
  return { error, data };
}

export async function hasAlreadyReplied(commentId: string) {
  if (IS_MOCK) return false;
  const sb = await getClient();
  if (!sb) return false;
  const { data } = await sb.from('replies').select('id').eq('comment_id', commentId).limit(1).single();
  return !!data;
}

export async function logAutomationAction(data: any) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data: inserted, error } = await sb.from('automation_logs').insert({ payload: data }).select().single();
  return { error, data: inserted };
}
