/**
 * Mock/placeholder functions for all features
 * These simulate API calls and will be replaced with real implementations
 */

export const mockAgents = {
  create: async (data: any) => {
    await new Promise(r => setTimeout(r, 500));
    return { id: `agent_${Date.now()}`, ...data, created_at: new Date() };
  },
  update: async (id: string, data: any) => {
    await new Promise(r => setTimeout(r, 500));
    return { id, ...data, updated_at: new Date() };
  },
  delete: async (id: string) => {
    await new Promise(r => setTimeout(r, 300));
    return { success: true };
  },
  list: async () => {
    await new Promise(r => setTimeout(r, 500));
    return [
      { id: '1', agent_name: 'Sales Assistant', system_prompt: 'You are a sales rep...', created_at: new Date() },
      { id: '2', agent_name: 'Support Bot', system_prompt: 'You are a support agent...', created_at: new Date() },
    ];
  },
};

export const mockAutomation = {
  createRule: async (data: any) => {
    await new Promise(r => setTimeout(r, 500));
    return { id: `rule_${Date.now()}`, ...data, created_at: new Date() };
  },
  triggerComment: async (data: any) => {
    await new Promise(r => setTimeout(r, 800));
    return { success: true, message_id: `msg_${Date.now()}` };
  },
  sendInboxReply: async (data: any) => {
    await new Promise(r => setTimeout(r, 600));
    return { success: true, message_id: `msg_${Date.now()}` };
  },
};

export const mockIntegrations = {
  connectMeta: async (token: string) => {
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, connected_at: new Date() };
  },
  connectWhatsApp: async (token: string) => {
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, connected_at: new Date() };
  },
  disconnect: async (integration: string) => {
    await new Promise(r => setTimeout(r, 500));
    return { success: true };
  },
};

export const mockBilling = {
  getPlans: async () => {
    await new Promise(r => setTimeout(r, 300));
    return [
      { id: 'starter', name: 'Starter', price: 99, features: ['1 Agent', 'Basic Analytics'] },
      { id: 'pro', name: 'Pro', price: 299, features: ['5 Agents', 'Advanced Analytics', 'API Access'] },
      { id: 'enterprise', name: 'Enterprise', price: 999, features: ['Unlimited', 'White-label', 'Priority Support'] },
    ];
  },
  procesPayment: async (data: any) => {
    await new Promise(r => setTimeout(r, 1500));
    return { success: true, transaction_id: `txn_${Date.now()}` };
  },
  getCurrentPlan: async () => {
    await new Promise(r => setTimeout(r, 300));
    return { id: 'starter', name: 'Starter', price: 99 };
  },
};

export const mockAnalytics = {
  getStats: async () => {
    await new Promise(r => setTimeout(r, 500));
    return {
      totalMessages: 5234,
      conversions: 642,
      conversionRate: 12.2,
      avgResponseTime: 1.2,
      topAgents: ['Sales Assistant', 'Support Bot'],
    };
  },
  getCharts: async () => {
    await new Promise(r => setTimeout(r, 700));
    return {
      messagesPerDay: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, count: Math.random() * 500 })),
      conversionFunnel: [{ stage: 'Inquiries', count: 5234 }, { stage: 'Engaged', count: 2150 }, { stage: 'Converted', count: 642 }],
    };
  },
};

export const mockSettings = {
  updateBusiness: async (data: any) => {
    await new Promise(r => setTimeout(r, 500));
    return { success: true, ...data };
  },
  inviteTeam: async (email: string) => {
    await new Promise(r => setTimeout(r, 500));
    return { success: true, invitation_sent: true };
  },
  generateApiKey: async () => {
    await new Promise(r => setTimeout(r, 300));
    return { api_key: `sk_${Math.random().toString(36).slice(2)}` };
  },
};

export const mockAuth = {
  getSession: async () => {
    return { user: { id: 'demo_user', email: 'demo@demo.local' }, session: null };
  },
};
