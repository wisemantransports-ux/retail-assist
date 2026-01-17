'use server'

import {
  getAllPlans as getAllPlansQuery,
  getPlanById as getPlanByIdQuery,
  getWorkspaceSubscription as getWorkspaceSubscriptionQuery,
  getBillingPaymentHistory as getBillingPaymentHistoryQuery,
  getPendingMobileMoneyPayments as getPendingMobileMoneyPaymentsQuery,
  createAutomationRule as createAutomationRuleQuery,
} from '@/lib/supabase/queries'
import type { Plan, Subscription, BillingPayment, AutomationRule } from '@/lib/types/database'

/**
 * Server actions for queries - these wrap the queries.ts functions
 * so that client components can safely call them without importing
 * server-side only code that includes fs/path imports.
 */

export async function getAllPlans(): Promise<{ data: Plan[] | null; error: any }> {
  try {
    return await getAllPlansQuery()
  } catch (error) {
    console.error('[getAllPlans] Error:', error)
    return { data: null, error }
  }
}

export async function getPlanById(planId: string): Promise<{ data: Plan | null; error: any }> {
  try {
    return await getPlanByIdQuery(planId)
  } catch (error) {
    console.error('[getPlanById] Error:', error)
    return { data: null, error }
  }
}

export async function getWorkspaceSubscription(workspaceId: string): Promise<{ data: Subscription | null; error: any }> {
  try {
    return await getWorkspaceSubscriptionQuery(workspaceId)
  } catch (error) {
    console.error('[getWorkspaceSubscription] Error:', error)
    return { data: null, error }
  }
}

export async function getBillingPaymentHistory(workspaceId: string): Promise<{ data: BillingPayment[] | null; error: any }> {
  try {
    return await getBillingPaymentHistoryQuery(workspaceId)
  } catch (error) {
    console.error('[getBillingPaymentHistory] Error:', error)
    return { data: null, error }
  }
}

export async function getPendingMobileMoneyPayments(workspaceId: string): Promise<{ data: any[] | null; error: any }> {
  try {
    return await getPendingMobileMoneyPaymentsQuery(workspaceId)
  } catch (error) {
    console.error('[getPendingMobileMoneyPayments] Error:', error)
    return { data: null, error }
  }
}

export async function createAutomationRule(
  workspaceId: string,
  agentId: string,
  rule: Partial<AutomationRule>
): Promise<{ data: AutomationRule | null; error: any }> {
  try {
    return await createAutomationRuleQuery(workspaceId, agentId, rule)
  } catch (error) {
    console.error('[createAutomationRule] Error:', error)
    return { data: null, error }
  }
}
