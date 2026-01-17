/**
 * Feature Gating Utility
 * 
 * Determines which features are available based on subscription status and plan type.
 * FREE users: read-only dashboard access only
 * PAID users: features based on plan_type and plan_limits
 */

export interface UserSubscription {
  subscription_status?: string;
  payment_status?: string;
  plan_type?: string;
  plan_limits?: {
    maxPages: number;
    maxEmployees?: number;
    hasInstagram: boolean;
    hasAiResponses: boolean;
    commentToDmLimit: number;
    aiTokenLimitMonthly: number;
    price: number;
  };
}

/**
 * Determine if user is on a FREE plan (unpaid or no active subscription)
 */
export function isFreeUser(user: UserSubscription): boolean {
  const isPaid = user.payment_status === 'paid';
  const isActive = user.subscription_status === 'active';
  return !isPaid || !isActive;
}

/**
 * Determine if user has an ACTIVE paid subscription
 */
export function isPaidUser(user: UserSubscription): boolean {
  return !isFreeUser(user);
}

/**
 * Check if user can connect integrations (Facebook, Instagram, Website Chat, WhatsApp)
 */
export function canConnectIntegrations(user: UserSubscription): boolean {
  return isPaidUser(user);
}

/**
 * Check if user can connect Facebook pages
 */
export function canConnectFacebook(user: UserSubscription): boolean {
  return isPaidUser(user);
}

/**
 * Check if user can use Instagram integration
 */
export function canUseInstagram(user: UserSubscription): boolean {
  return isPaidUser(user) && (user.plan_limits?.hasInstagram || false);
}

/**
 * Check if user can create/edit agents
 */
export function canManageAgents(user: UserSubscription): boolean {
  return isPaidUser(user) && (user.plan_limits?.hasAiResponses || false);
}

/**
 * Check if user can create/edit automation rules
 */
export function canCreateAutomationRules(user: UserSubscription): boolean {
  return isPaidUser(user);
}

/**
 * Check if user can send messages via integrations
 */
export function canSendMessages(user: UserSubscription): boolean {
  return isPaidUser(user);
}

/**
 * Get the number of pages the user can connect
 */
export function getMaxPages(user: UserSubscription): number {
  if (!isPaidUser(user)) return 0;
  return user.plan_limits?.maxPages || 0;
}

/**
 * Get the monthly comment-to-DM limit
 */
export function getCommentToDmLimit(user: UserSubscription): number {
  if (!isPaidUser(user)) return 0;
  return user.plan_limits?.commentToDmLimit || 0;
}

/**
 * Get the monthly AI token limit for the user's plan
 * Per PRICING_REFERENCE.MD:
 * - Starter: 50,000 tokens/month
 * - Pro: 150,000 tokens/month
 * - Advanced: 500,000 tokens/month
 * - Enterprise: Custom (backend enforces)
 */
export function getAiTokenLimit(user: UserSubscription): number {
  if (!isPaidUser(user)) return 0;
  return user.plan_limits?.aiTokenLimitMonthly || 0;
}

/**
 * Get user's access level
 */
export function getUserAccessLevel(user: UserSubscription): 'free' | 'paid' {
  return isFreeUser(user) ? 'free' : 'paid';
}

/**
 * Get friendly message for locked feature
 */
export function getUpgradeMessage(featureName: string): string {
  return `${featureName} is only available on paid plans. Upgrade to unlock this feature.`;
}

/**
 * Get the maximum number of employees allowed on user's plan
 */
export function getMaxEmployees(user: UserSubscription): number {
  if (!isPaidUser(user)) return 0;
  return user.plan_limits?.maxEmployees || 0;
}

/**
 * Check if user can add more employees based on plan limit
 */
export function canAddEmployee(user: UserSubscription, currentEmployeeCount: number): boolean {
  if (!isPaidUser(user)) return false;
  
  const maxEmployees = getMaxEmployees(user);
  
  // Enterprise (-1) = unlimited
  if (maxEmployees === -1) return true;
  
  // Check if under limit
  return currentEmployeeCount < maxEmployees;
}

/**
 * Get friendly message for employee limit
 */
export function getEmployeeLimitMessage(user: UserSubscription, currentCount: number): string {
  const maxEmployees = getMaxEmployees(user);
  
  if (maxEmployees === -1) {
    return 'Unlimited employees';
  }
  
  const remaining = maxEmployees - currentCount;
  if (remaining <= 0) {
    return `Your ${user.plan_type} plan allows only ${maxEmployees} employee(s). Upgrade to add more.`;
  }
  
  return `${currentCount} of ${maxEmployees} employees used`;
}

/**
 * Get lock reason for employee management
 */
export function getEmployeeLockReason(user: UserSubscription, currentCount: number): string {
  if (isFreeUser(user)) {
    return 'Employee management is only available on paid plans.';
  }
  
  const maxEmployees = getMaxEmployees(user);
  
  if (maxEmployees === -1) {
    return 'Unlimited employees';
  }
  
  if (currentCount >= maxEmployees) {
    return `Your ${user.plan_type} plan allows only ${maxEmployees} employee(s). Upgrade to add more.`;
  }
  
  return '';
}

/**
 * Get lock reason for a feature
 */
export function getLockReason(user: UserSubscription, featureName: string): string {
  if (isFreeUser(user)) {
    return 'This feature requires a paid subscription.';
  }
  
  // Feature might be locked due to plan limits even for paid users
  switch (featureName) {
    case 'Instagram':
      return 'Instagram is available on Pro, Advanced, and Enterprise plans.';
    case 'Additional Pages':
      return `You can connect up to ${getMaxPages(user)} page(s) on your current plan.`;
    case 'Employees':
      return `You can manage up to ${getMaxEmployees(user)} employee(s) on your ${user.plan_type} plan.`;
    default:
      return `This feature is not available on your ${user.plan_type} plan.`;
  }
}

/**
 * ========================================
 * PLAN-AWARE SUBSCRIPTION SYSTEM
 * ========================================
 * Enhanced feature gating functions for the new multi-tier plan system
 * (Starter, Pro, Advanced, Enterprise)
 */

/**
 * Check if user can connect a new account (page/channel)
 * @param user - User subscription info
 * @param currentPageCount - How many pages/accounts user already has
 * @param platform - Optional: 'facebook' | 'instagram' | 'website' | 'whatsapp'
 * @returns true if user can add more accounts
 */
export function canConnectAccount(
  user: UserSubscription,
  currentPageCount: number = 0,
  platform?: string
): boolean {
  if (!isPaidUser(user)) return false;
  
  const maxPages = getMaxPages(user);
  
  // Unlimited pages (Advanced, Enterprise)
  if (maxPages === -1) return true;
  
  // Check if under limit
  return currentPageCount < maxPages;
}

/**
 * Check if user can add another channel/account of a specific platform
 * Starter plan: Only 1 account total (Facebook OR Instagram, not both)
 * Pro: Multiple as per plan limit
 * Advanced/Enterprise: Unlimited
 */
export function canAddChannelForPlatform(
  user: UserSubscription,
  platform: 'facebook' | 'instagram' | 'website' | 'whatsapp',
  currentFacebookCount: number = 0,
  currentInstagramCount: number = 0
): boolean {
  if (!isPaidUser(user)) return false;
  
  const planType = user.plan_type || 'starter';
  const maxPages = getMaxPages(user);
  
  // Unlimited accounts
  if (maxPages === -1) return true;
  
  // Starter plan: Only 1 account total (no mixing)
  if (planType === 'starter') {
    const totalAccounts = currentFacebookCount + currentInstagramCount;
    return totalAccounts < 1;
  }
  
  // Pro/Advanced: Check against max limit
  const currentTotal = currentFacebookCount + currentInstagramCount;
  return currentTotal < maxPages;
}

/**
 * Check if user can use AI features
 * @param user - User subscription info
 * @param requestedTokens - How many AI tokens the action needs
 * @param currentTokenUsage - How many tokens used this month
 * @returns true if user has sufficient AI token allocation
 */
export function canUseAI(
  user: UserSubscription,
  requestedTokens: number = 0,
  currentTokenUsage: number = 0
): boolean {
  if (!isPaidUser(user)) return false;
  
  // Enterprise or unlimited
  if (!user.plan_limits?.aiTokenLimitMonthly) return true;
  
  const limit = user.plan_limits.aiTokenLimitMonthly;
  if (limit === -1) return true;  // Unlimited
  
  const remaining = limit - currentTokenUsage;
  return remaining >= requestedTokens;
}

/**
 * Get remaining AI tokens for the current month
 * @returns Number of tokens remaining (-1 if unlimited)
 */
export function getRemainingAITokens(
  user: UserSubscription,
  currentTokenUsage: number = 0
): number {
  if (!isPaidUser(user)) return 0;
  
  const limit = getAiTokenLimit(user);
  if (limit === -1) return -1;  // Unlimited
  
  return Math.max(0, limit - currentTokenUsage);
}

/**
 * Get a message about page/account capacity
 */
export function getPageCapacityMessage(
  user: UserSubscription,
  currentPageCount: number = 0
): string {
  if (!isPaidUser(user)) {
    return 'Account connections require a paid subscription.';
  }
  
  const maxPages = getMaxPages(user);
  
  if (maxPages === -1) {
    return 'Unlimited account connections';
  }
  
  const remaining = maxPages - currentPageCount;
  if (remaining <= 0) {
    return `Your ${user.plan_type} plan allows only ${maxPages} account(s). Upgrade to connect more.`;
  }
  
  return `${currentPageCount} of ${maxPages} accounts connected`;
}

/**
 * Get a message about AI token usage
 */
export function getAITokenMessage(
  user: UserSubscription,
  currentTokenUsage: number = 0
): string {
  if (!isPaidUser(user)) {
    return 'AI features require a paid subscription.';
  }
  
  const limit = getAiTokenLimit(user);
  
  if (limit === -1) {
    return 'Unlimited AI tokens';
  }
  
  const remaining = limit - currentTokenUsage;
  if (remaining <= 0) {
    return `Your ${user.plan_type} plan AI token limit reached. Upgrade for more capacity.`;
  }
  
  const percentUsed = Math.round((currentTokenUsage / limit) * 100);
  return `${percentUsed}% of monthly AI tokens used (${currentTokenUsage.toLocaleString()} of ${limit.toLocaleString()})`;
}

/**
 * Check if user can create automation rules
 * Note: Different from canCreateAutomationRules() - this is plan-aware
 */
export function canCreateAutomationRule(
  user: UserSubscription,
  currentRuleCount: number = 0
): boolean {
  if (!isPaidUser(user)) return false;
  
  const planType = user.plan_type || 'starter';
  
  // Determine automation rule limit based on plan
  const limits: Record<string, number> = {
    starter: 3,
    pro: 15,
    advanced: -1,   // Unlimited
    enterprise: -1, // Unlimited
  };
  
  const maxRules = limits[planType] || 0;
  
  // Unlimited rules
  if (maxRules === -1) return true;
  
  // Check against limit
  return currentRuleCount < maxRules;
}

/**
 * Get automation rule limit for user's plan
 */
export function getAutomationRuleLimit(user: UserSubscription): number {
  if (!isPaidUser(user)) return 0;
  
  const planType = user.plan_type || 'starter';
  const limits: Record<string, number> = {
    starter: 3,
    pro: 15,
    advanced: -1,   // Unlimited
    enterprise: -1, // Unlimited
  };
  
  return limits[planType] || 0;
}
