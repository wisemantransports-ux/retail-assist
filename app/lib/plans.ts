/**
 * Plan Configuration
 * 
 * Central source of truth for all subscription plan definitions.
 * Each plan defines:
 * - Pricing and billing
 * - Resource limits (employees, channels, AI tokens)
 * - Feature availability
 * - Automation capabilities
 * 
 * Usage:
 * - Backend: Enforce limits in API endpoints
 * - Frontend: Gate UI components based on plan
 * - Billing: Display plan features and pricing
 */

export type PlanType = 'starter' | 'pro' | 'advanced' | 'enterprise';

export interface PlanDefinition {
  id: PlanType;
  name: string;
  price: number;
  billingPeriod: 'monthly' | 'annual';
  description: string;
  
  // Resource limits
  limits: {
    maxEmployees: number;        // -1 = unlimited
    maxPages: number;            // Connected social accounts (Facebook/Instagram)
    maxChannels: number;         // Total integrations (Facebook, Instagram, Website Chat, WhatsApp, etc.)
    aiTokenLimit: number;        // Monthly AI token limit (-1 = unlimited)
    automationRuleLimit: number; // Max automation rules
  };
  
  // Feature flags
  features: {
    hasInstagram: boolean;
    hasAiResponses: boolean;
    hasAutomation: boolean;
    hasCommentToDm: boolean;
    hasAdvancedReporting: boolean;
    hasTeamManagement: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
  
  // Operational limits
  operations: {
    commentToDmLimit: number;    // Comments converted to DMs per month (-1 = unlimited)
    messageLimit: number;        // Messages per month (-1 = unlimited)
    automationLevel: 'basic' | 'advanced' | 'enterprise';
  };
  
  // Metadata
  notes: string[];
  recommended?: boolean;
}

/**
 * All plan definitions
 * Ordered from most basic to most comprehensive
 */
export const PLANS: Record<PlanType, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 22,
    billingPeriod: 'monthly',
    description: 'Perfect for small businesses getting started with automation',
    
    limits: {
      maxEmployees: 2,
      maxPages: 1,
      maxChannels: 1,
      aiTokenLimit: 10000,      // 10K tokens/month
      automationRuleLimit: 3,
    },
    
    features: {
      hasInstagram: false,
      hasAiResponses: true,
      hasAutomation: true,
      hasCommentToDm: true,
      hasAdvancedReporting: false,
      hasTeamManagement: false,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false,
    },
    
    operations: {
      commentToDmLimit: 100,
      messageLimit: 1000,
      automationLevel: 'basic',
    },
    
    notes: [
      '1 Facebook page connection',
      '2 team members',
      'Basic AI-powered responses',
      'Comment-to-DM automation (100/month)',
      'Up to 1,000 messages/month',
      '10,000 AI tokens/month',
      'Email support',
    ],
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    price: 45,
    billingPeriod: 'monthly',
    description: 'For growing businesses managing multiple channels',
    recommended: true,
    
    limits: {
      maxEmployees: 5,
      maxPages: 3,
      maxChannels: 3,
      aiTokenLimit: 50000,       // 50K tokens/month
      automationRuleLimit: 15,
    },
    
    features: {
      hasInstagram: true,
      hasAiResponses: true,
      hasAutomation: true,
      hasCommentToDm: true,
      hasAdvancedReporting: true,
      hasTeamManagement: true,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false,
    },
    
    operations: {
      commentToDmLimit: 500,
      messageLimit: 5000,
      automationLevel: 'advanced',
    },
    
    notes: [
      'Up to 3 pages/accounts',
      'Facebook & Instagram automation',
      '5 team members',
      'Advanced AI responses',
      'Comment-to-DM automation (500/month)',
      'Up to 5,000 messages/month',
      '50,000 AI tokens/month',
      'Advanced analytics & reporting',
      'Priority email support',
    ],
  },

  advanced: {
    id: 'advanced',
    name: 'Advanced',
    price: 95,
    billingPeriod: 'monthly',
    description: 'For enterprises scaling across multiple platforms',
    
    limits: {
      maxEmployees: 15,
      maxPages: -1,              // Unlimited
      maxChannels: -1,           // Unlimited
      aiTokenLimit: 500000,      // 500K tokens/month
      automationRuleLimit: -1,   // Unlimited
    },
    
    features: {
      hasInstagram: true,
      hasAiResponses: true,
      hasAutomation: true,
      hasCommentToDm: true,
      hasAdvancedReporting: true,
      hasTeamManagement: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: true,
    },
    
    operations: {
      commentToDmLimit: -1,      // Unlimited
      messageLimit: -1,          // Unlimited
      automationLevel: 'enterprise',
    },
    
    notes: [
      'Unlimited pages/accounts',
      'All channels & integrations',
      '15 team members',
      'Enterprise-grade AI',
      'Unlimited comment-to-DM',
      'Unlimited messaging',
      '500,000 AI tokens/month',
      'Custom branding options',
      'REST API access',
      'Webhook integration',
      'Phone & email support',
      'Quarterly business reviews',
    ],
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,                    // Custom pricing
    billingPeriod: 'monthly',
    description: 'Unlimited everything with white-glove support',
    
    limits: {
      maxEmployees: -1,          // Unlimited
      maxPages: -1,              // Unlimited
      maxChannels: -1,           // Unlimited
      aiTokenLimit: -1,          // Unlimited
      automationRuleLimit: -1,   // Unlimited
    },
    
    features: {
      hasInstagram: true,
      hasAiResponses: true,
      hasAutomation: true,
      hasCommentToDm: true,
      hasAdvancedReporting: true,
      hasTeamManagement: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: true,
    },
    
    operations: {
      commentToDmLimit: -1,      // Unlimited
      messageLimit: -1,          // Unlimited
      automationLevel: 'enterprise',
    },
    
    notes: [
      'Unlimited everything',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee (99.9% uptime)',
      'Advanced security & compliance',
      'Custom training & onboarding',
      'Phone, email & video support',
      'Annual contract with volume discounts',
    ],
  },
};

/**
 * Get a plan definition by type
 * @param planType - The plan ID ('starter', 'pro', 'advanced', 'enterprise')
 * @returns The plan definition, or starter as fallback
 */
export function getPlan(planType: string): PlanDefinition {
  return PLANS[planType as PlanType] || PLANS.starter;
}

/**
 * Get all plans sorted by tier (cheapest to most expensive)
 */
export function getAllPlans(): PlanDefinition[] {
  return Object.values(PLANS);
}

/**
 * Get a specific plan's limit value
 * Usage: getPlanLimit('pro', 'maxEmployees') → 5
 */
export function getPlanLimit(planType: string, limitKey: keyof PlanDefinition['limits']): number {
  const plan = getPlan(planType);
  return plan.limits[limitKey];
}

/**
 * Check if a resource limit is unlimited for a plan
 * Usage: isPlanLimitUnlimited('pro', 'maxPages') → false
 *        isPlanLimitUnlimited('advanced', 'maxPages') → true
 */
export function isPlanLimitUnlimited(planType: string, limitKey: keyof PlanDefinition['limits']): boolean {
  const limit = getPlanLimit(planType, limitKey);
  return limit === -1;
}

/**
 * Get all plan names for dropdown/selector UI
 */
export function getPlanNames(): { id: PlanType; name: string }[] {
  return Object.entries(PLANS).map(([id, plan]) => ({
    id: id as PlanType,
    name: plan.name,
  }));
}

/**
 * Check if a plan has a specific feature
 * Usage: hasPlanFeature('pro', 'hasInstagram') → true
 *        hasPlanFeature('starter', 'hasInstagram') → false
 */
export function hasPlanFeature(planType: string, featureKey: keyof PlanDefinition['features']): boolean {
  const plan = getPlan(planType);
  return plan.features[featureKey];
}

/**
 * Calculate how many more resources can be added
 * Usage: getRemainingCapacity('pro', 'maxEmployees', 3) → 2
 *        getRemainingCapacity('enterprise', 'maxEmployees', 1000) → -1 (unlimited)
 */
export function getRemainingCapacity(
  planType: string,
  limitKey: keyof PlanDefinition['limits'],
  currentCount: number
): number {
  const limit = getPlanLimit(planType, limitKey);
  
  // Unlimited = -1
  if (limit === -1) return -1;
  
  // Remaining = max - current
  return Math.max(0, limit - currentCount);
}

/**
 * Get a human-readable message about a plan limit
 * Usage: getCapacityMessage('pro', 'maxEmployees', 3) 
 *        → "3 of 5 employees used"
 */
export function getCapacityMessage(
  planType: string,
  limitKey: keyof PlanDefinition['limits'],
  currentCount: number
): string {
  const plan = getPlan(planType);
  const limit = plan.limits[limitKey];
  
  if (limit === -1) {
    return `Unlimited ${limitKey.replace(/^max/, '').toLowerCase()}`;
  }
  
  return `${currentCount} of ${limit} ${limitKey.replace(/^max/, '').toLowerCase()} used`;
}

/**
 * Export legacy PLAN_LIMITS object for backward compatibility
 * Maps old structure to new plans
 */
export const LEGACY_PLAN_LIMITS = {
  starter: {
    name: PLANS.starter.name,
    price: PLANS.starter.price,
    maxPages: PLANS.starter.limits.maxPages,
    maxEmployees: PLANS.starter.limits.maxEmployees,
    hasInstagram: PLANS.starter.features.hasInstagram,
    hasAiResponses: PLANS.starter.features.hasAiResponses,
    commentToDmLimit: PLANS.starter.operations.commentToDmLimit,
    aiTokenLimitMonthly: PLANS.starter.limits.aiTokenLimit,
    features: PLANS.starter.notes,
  },
  pro: {
    name: PLANS.pro.name,
    price: PLANS.pro.price,
    maxPages: PLANS.pro.limits.maxPages,
    maxEmployees: PLANS.pro.limits.maxEmployees,
    hasInstagram: PLANS.pro.features.hasInstagram,
    hasAiResponses: PLANS.pro.features.hasAiResponses,
    commentToDmLimit: PLANS.pro.operations.commentToDmLimit,
    aiTokenLimitMonthly: PLANS.pro.limits.aiTokenLimit,
    features: PLANS.pro.notes,
  },
  enterprise: {
    name: PLANS.enterprise.name,
    price: PLANS.enterprise.price,
    maxPages: PLANS.enterprise.limits.maxPages,
    maxEmployees: PLANS.enterprise.limits.maxEmployees,
    hasInstagram: PLANS.enterprise.features.hasInstagram,
    hasAiResponses: PLANS.enterprise.features.hasAiResponses,
    commentToDmLimit: PLANS.enterprise.operations.commentToDmLimit,
    aiTokenLimitMonthly: PLANS.enterprise.limits.aiTokenLimit,
    features: PLANS.enterprise.notes,
  },
} as const;
