/**
 * Stub Supabase queries - This app uses file-based JSON storage, not Supabase.
 * These exports exist to satisfy imports without breaking the build.
 */

export async function getPendingMobileMoneyPayments(workspaceId: string) {
  return { error: null, data: [] };
}

export async function insertSystemLog(...args: any[]) {
  return { error: null };
}

export async function acceptInvite(token: string, userId: string) {
  return { error: 'Not implemented - using file-based JSON storage', data: null };
}

export async function getWorkspaceMembers(workspaceId: string) {
  return { error: null, data: [] };
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  return { error: null, data: null };
}

export async function updateMemberRole(...args: any[]) {
  return { error: null, data: null };
}

export async function createInvite(workspaceId: string, email: string, role: string) {
  return { error: null, data: null };
}

export async function getAgent(agentId: string) {
  return { error: null, data: null };
}

export async function getAgentById(agentId: string): Promise<any> {
  return { 
    error: null, 
    data: null, 
    enabled: false, 
    workspace_id: null, 
    system_prompt: null, 
    model: null, 
    name: null,
    temperature: null,
    max_tokens: null,
    id: null,
    created_at: null,
    updated_at: null,
    fallback: null,
    api_key: null,
    description: null,
    greeting: null
  };
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
  return { error: null, data: [] };
}

export async function createAgent(workspaceIdOrData: any, data?: any) {
  return { error: null, data: null };
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
  return { error: null, data: null };
}

export async function updateUser(userId: string, data: any) {
  return { error: null, data: null };
}

export async function getWorkspace(workspaceId: string) {
  return { error: null, data: null };
}

export async function updateWorkspace(workspaceId: string, data: any) {
  return { error: null, data: null };
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

export async function removeMember(...args: any[]) {
  return { error: null, data: null };
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
