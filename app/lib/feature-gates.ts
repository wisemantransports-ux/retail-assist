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
    default:
      return `This feature is not available on your ${user.plan_type} plan.`;
  }
}
