/**
 * PRICING CONFIGURATION - AUTHORITATIVE SYSTEM CONTRACT
 *
 * This file defines the pricing and plan structure for Retail Assist SaaS.
 * It is READ-ONLY configuration and contains NO enforcement logic.
 *
 * ⚠️ CRITICAL NOTE:
 * This file is the single source of truth for plan definitions.
 * All enforcement (API validation, database constraints, usage limits, feature gates)
 * must be implemented separately at the backend/SQL level and must mirror this contract.
 * Frontend and configuration changes MUST NOT precede backend enforcement.
 */

export type PlanId = 'starter' | 'pro' | 'advanced' | 'enterprise';

export type Currency = 'USD' | 'BWP';

export interface ChannelAccess {
  facebook: boolean;
  instagram: boolean;
  websiteChat: boolean;
  whatsapp?: boolean; // Coming soon
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  displayName: string;
  description: string;
  
  // Pricing (enterprise: null = contact sales)
  priceUsd: number | null;
  priceBwp: number | null;
  
  // Features
  channels: ChannelAccess;
  unifiedInbox: boolean;
  automationLevel: 'basic' | 'advanced' | 'full' | 'custom';
  aiAutoRepliesEnabled: boolean;
  aiTokenLimitMonthly: number | null; // null = custom/unlimited
  
  // Support
  supportLevel: 'community' | 'priority' | 'dedicated';
  
  // Constraints
  overagePolicy: 'not_allowed'; // All plans: upgrade required, no grace period
  workspaceLimit: number; // 1, 1, unlimited, custom
  
  // Metadata
  whiteLabel: boolean;
  popular?: boolean;
}

/**
 * PLANS CONSTANT - DO NOT MODIFY WITHOUT UPDATING BACKEND ENFORCEMENT
 *
 * Usage Policy:
 * - Users are notified when 80% of monthly AI tokens are consumed
 * - All plans: over-usage NOT ALLOWED (users must upgrade)
 * - No grace periods, no soft limits, no auto-downgrades
 * - Enforcement is handled at backend/SQL level (not in this file)
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    displayName: 'Starter',
    description: 'Perfect for small businesses just getting started',
    
    priceUsd: 350,
    priceBwp: 25,
    
    channels: {
      facebook: true,
      instagram: true,
      websiteChat: true,
      whatsapp: false,
    },
    unifiedInbox: true,
    automationLevel: 'basic',
    aiAutoRepliesEnabled: true,
    aiTokenLimitMonthly: 50000,
    
    supportLevel: 'community',
    overagePolicy: 'not_allowed',
    workspaceLimit: 1,
    whiteLabel: false,
    popular: false,
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    description: 'For growing businesses with higher volume',
    
    priceUsd: 600,
    priceBwp: 36,
    
    channels: {
      facebook: true,
      instagram: true,
      websiteChat: true,
      whatsapp: false,
    },
    unifiedInbox: true,
    automationLevel: 'advanced',
    aiAutoRepliesEnabled: true,
    aiTokenLimitMonthly: 150000,
    
    supportLevel: 'priority',
    overagePolicy: 'not_allowed',
    workspaceLimit: 1,
    whiteLabel: false,
    popular: true,
  },

  advanced: {
    id: 'advanced',
    name: 'Advanced',
    displayName: 'Advanced',
    description: 'For enterprises with maximum scale and flexibility',
    
    priceUsd: 900,
    priceBwp: 72,
    
    channels: {
      facebook: true,
      instagram: true,
      websiteChat: true,
      whatsapp: false,
    },
    unifiedInbox: true,
    automationLevel: 'full',
    aiAutoRepliesEnabled: true,
    aiTokenLimitMonthly: 500000,
    
    supportLevel: 'priority',
    overagePolicy: 'not_allowed',
    workspaceLimit: Infinity, // Unlimited
    whiteLabel: false,
    popular: false,
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Enterprise',
    description: 'White-labeled solution with custom integration and dedicated support',
    
    priceUsd: null, // Contact sales
    priceBwp: null,
    
    channels: {
      facebook: true,
      instagram: true,
      websiteChat: true,
      whatsapp: true, // Custom available
    },
    unifiedInbox: true,
    automationLevel: 'custom',
    aiAutoRepliesEnabled: true,
    aiTokenLimitMonthly: null, // Custom per contract
    
    supportLevel: 'dedicated',
    overagePolicy: 'not_allowed',
    workspaceLimit: Infinity, // Custom per contract
    whiteLabel: true,
    popular: false,
  },
};

/**
 * ENFORCEMENT NOTE (For Backend Developers):
 *
 * The following must be enforced at the backend/SQL level:
 * 1. AI token usage tracking per workspace per month
 * 2. 80% usage notification at backend when tokens consumed >= 0.8 * limit
 * 3. Block further AI requests when tokens consumed >= 100% of limit
 * 4. Enforce workspace limits (1 vs unlimited) via RLS/CHECK constraints
 * 5. Enforce channel availability per plan at API level
 * 6. Enforce automation level restrictions per plan
 * 7. No client-side trust: validation must happen server-side always
 *
 * This file provides no enforcement — it is configuration only.
 */
