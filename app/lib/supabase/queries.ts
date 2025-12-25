/**
 * Stub Supabase queries - This app uses file-based JSON storage, not Supabase.
 * These exports exist to satisfy imports without breaking the build.
 */

import { getBrowserSupabaseClient } from './client';
import { getServiceSupabaseClient } from './serverClient';

const IS_MOCK = (process.env.NEXT_PUBLIC_USE_DEV_AUTH === 'true' || process.env.USE_MOCK_DB === 'true');

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
  return { error: null };
}

export async function acceptInvite(token: string, userId: string) {
  if (IS_MOCK) return { error: 'mock-mode', data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  // token handling depends on invite implementation; basic example
  const { data: invite, error: inviteErr } = await sb.from('invites').select('*').eq('token', token).limit(1).single();
  if (inviteErr || !invite) return { error: inviteErr || 'invite-not-found', data: null };
  const { data, error } = await sb.from('workspace_members').insert({ workspace_id: invite.workspace_id, user_id: userId, role: invite.role }).select().single();
  return { error, data };
}

export async function getWorkspaceMembers(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: [] };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: [] };
  const { data, error } = await sb
    .from('workspace_members')
    .select('role, users(id, auth_uid, email, full_name)')
    .eq('workspace_id', workspaceId);
  return { error, data };
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { error, data } = await sb.from('workspace_members').delete().match({ workspace_id: workspaceId, user_id: userId });
  return { error, data };
}

export async function updateMemberRole(...args: any[]) {
  return { error: null, data: null };
}

export async function createInvite(workspaceId: string, email: string, role: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const token = cryptoRandomToken();
  const { data, error } = await sb.from('invites').insert({ workspace_id: workspaceId, email, role, token }).select().single();
  return { error, data };
}

function cryptoRandomToken(len = 48) {
  // simple token generator for seeds; for production use a secure method
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
  return { error: null, data: null };
}

export async function deleteAgent(agentId: string) {
  return { error: null, data: null };
}

export async function getAgentComments(agentId: string) {
  return { error: null, data: [] };
}

export async function createPayment(...args: any[]) {
  return { error: null, data: null };
}

export async function updatePaymentStatus(...args: any[]) {
  return { error: null, data: null };
}

export async function getSubscription(workspaceId: string) {
  return { error: null, data: null };
}

export async function updateSubscription(workspaceId: string, data: any) {
  return { error: null, data: null };
}

export async function getAutomationRule(ruleId: string) {
  return { error: null, data: null };
}

export async function getAutomationRules(workspaceId: string, agentId?: string, enabledOnly?: boolean) {
  return [];
}

export async function updateAutomationRule(ruleId: string, data: any) {
  return { error: null, data: null };
}

export async function deleteAutomationRule(ruleId: string) {
  return { error: null, data: null };
}

export async function approveMobileMoneyPayment(...args: any[]) {
  return { error: null, data: null };
}

export async function rejectMobileMoneyPayment(...args: any[]) {
  return { error: null, data: null };
}

export async function confirmMobileMoneyPaymentBilling(...args: any[]) {
  return { error: null, data: null };
}

export async function updateSubscriptionBilling(workspaceId: string, data: any) {
  return { error: null, data: null };
}

export async function recordBillingEvent(...args: any[]) {
  return { error: null, data: null };
}

export async function saveComment(agentId: string, data?: any) {
  return { error: null, data: null, id: null };
}

export async function createDirectMessage(workspaceIdOrData: any, data?: any): Promise<any> {
  return { error: null, data: null, id: null };
}

export async function markCommentProcessed(...args: any[]): Promise<any> {
  return { error: null, data: null };
}

export async function logMessage(workspaceIdOrData: any, data?: any) {
  return { error: null, data: null };
}

export async function initiateMobileMoneyPayment(data: any) {
  return { error: null, data: null };
}

export async function createMobileMoneyPayment(data: any) {
  return { error: null, data: null };
}

export async function getWorkspaceInvites(workspaceId: string) {
  return { error: null, data: [] };
}

export async function deleteInvite(inviteId: string) {
  return { error: null, data: null };
}

export async function createWorkspaceInvite(data: any) {
  return { error: null, data: null };
}

export async function getPayPalSubscription(subscriptionId: string) {
  return { error: null, data: null };
}

export async function createPayPalSubscription(data: any) {
  return { error: null, data: null };
}

export async function updatePayPalSubscription(subscriptionId: string, data: any) {
  return { error: null, data: null };
}

export async function getStripeCustomer(customerId: string) {
  return { error: null, data: null };
}

export async function createStripeCustomer(data: any) {
  return { error: null, data: null };
}

export async function updateStripeCustomer(customerId: string, data: any) {
  return { error: null, data: null };
}

export async function handleStripeWebhook(event: any) {
  return { error: null, data: null };
}

export async function handlePayPalWebhook(event: any) {
  return { error: null, data: null };
}

export async function getAgents(workspaceId: string) {
  if (IS_MOCK) return { error: null, data: [] };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: [] };
  const { data, error } = await sb.from('agents').select('*').eq('workspace_id', workspaceId);
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
  return { error: null, data: null };
}

export async function getAllPlans() {
  return { error: null, data: [] };
}

export async function getPlanById(planId: string) {
  return { error: null, data: null };
}

export async function getWorkspaceBilling(workspaceId: string) {
  return { error: null, data: null };
}

export async function updateWorkspaceBilling(workspaceId: string, data: any) {
  return { error: null, data: null };
}

export async function createPayPalOrder(data: any) {
  return { error: null, data: null };
}

export async function capturePayPalOrder(orderId: string) {
  return { error: null, data: null };
}

export async function getUser(userId: string) {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient();
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('users').select('*').eq('id', userId).limit(1).single();
  return { error, data };
}

export async function updateUser(userId: string, data: any) {
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
  return { error: null, data: null };
}

export async function getManualApprovals() {
  return { error: null, data: [] };
}

export async function approvePayment(paymentId: string) {
  return { error: null, data: null };
}

export async function getComments(agentId: string) {
  return { error: null, data: [] };
}

export async function runAutomation(ruleId: string, data: any) {
  return { error: null, data: null };
}

export async function getUserSubscription(userId: string): Promise<any> {
  return null;
}

export async function saveMobileMoneyPayment(...args: any[]) {
  return { error: null, data: null };
}

export async function removeMember(workspaceId: string, userId: string) {
  return removeWorkspaceMember(workspaceId, userId);
}

export async function addWorkspaceMember(workspaceId: string, userId: string, role = 'member') {
  if (IS_MOCK) return { error: null, data: null };
  const sb = await getClient(true);
  if (!sb) return { error: 'supabase-not-configured', data: null };
  const { data, error } = await sb.from('workspace_members').insert({ workspace_id: workspaceId, user_id: userId, role }).select().single();
  return { error, data };
}


export async function inviteMember(...args: any[]) {
  return { error: null, data: null };
}

export async function updateSubscriptionStatus(...args: any[]) {
  return { error: null, data: null };
}

export async function getSubscriptionByProviderId(providerId: string): Promise<any> {
  return null;
}

export async function getWorkspaceSubscription(workspaceId: string) {
  return { error: null, data: null };
}

export async function getBillingPaymentHistory(workspaceId: string) {
  return { error: null, data: [] };
}

export async function recordPaymentSuccess(data: any) {
  return { error: null, data: null };
}

export async function recordBillingPayment(...args: any[]) {
  return { error: null, data: null };
}

export async function createMobileMoneyPaymentBilling(...args: any[]) {
  return { error: null, data: null };
}

export async function createSubscription(data: any) {
  return { error: null, data: null };
}

export async function getCurrentUser() {
  return { error: null, data: null };
}

export async function hasAlreadyReplied(commentId: string) {
  return false;
}

export async function logAutomationAction(data: any) {
  return { error: null, data: null };
}
