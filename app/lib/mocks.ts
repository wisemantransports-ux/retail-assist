/**
 * Development mock utilities — used only when `env.useMockMode` is true.
 *
 * These functions provide fake data for the dashboard and settings pages so the
 * frontend works without Supabase or external services enabled.
 *
 * IMPORTANT: Do NOT use these in production. To go live, set
 * `NEXT_PUBLIC_USE_MOCK_SUPABASE=false` in your environment and provide real
 * SUPABASE_* and payment credentials. See the "Go Live Checklist" for details.
 */
import { env } from './env'

function wait(ms = 400) {
  return new Promise((r) => setTimeout(r, ms))
}

export const mockAnalytics = {
  getStats: async () => {
    await wait(500)
    return {
      totalMessages: 5234,
      conversions: 642,
      conversionRate: 12.2,
      avgResponseTime: 1.2,
      topAgents: ['Sales Assistant', 'Support Bot'],
    }
  },

  getCharts: async () => {
    await wait(700)
    return {
      messagesPerDay: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, count: Math.round(Math.random() * 500) })),
      conversionFunnel: [
        { stage: 'Inquiries', count: 5234 },
        { stage: 'Engaged', count: 2150 },
        { stage: 'Converted', count: 642 },
      ],
    }
  },
}

export const mockSettings = {
  updateBusiness: async (data: any) => {
    await wait(500)
    // echo back the data so UI can show success
    return { success: true, ...data }
  },

  inviteTeam: async (email: string) => {
    await wait(400)
    return { success: true, invitation_sent: true }
  },

  generateApiKey: async () => {
    await wait(300)
    return { api_key: `sk_${Math.random().toString(36).slice(2)}` }
  },
}

export const mockAuth = {
  getSession: async () => {
    // Simple demo session used on dashboard pages when in mock mode
    if (!env.useMockMode) return null
    return { user: { id: 'demo_user', email: 'demo@demo.local', role: 'user' }, session: null }
  },
}

export const mockBilling = {
  getPlans: async () => {
    await wait(300)
    return [
      { id: 'starter', name: 'Starter', price: 22, features: ['1 Page', 'Basic AI'] },
      { id: 'pro', name: 'Pro', price: 45, features: ['3 Pages', 'Instagram'] },
      { id: 'enterprise', name: 'Enterprise', price: 75, features: ['Unlimited'] },
    ]
  },

  processPayment: async (data: any) => {
    await wait(1200)
    return { success: true, transaction_id: `txn_${Date.now()}` }
  },

  getCurrentPlan: async () => {
    await wait(200)
    return { id: 'starter', name: 'Starter', price: 22 }
  },
}
