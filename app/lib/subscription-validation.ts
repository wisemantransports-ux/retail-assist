/**
 * API Subscription Validation
 * 
 * Helper functions to validate subscription status in API routes.
 * Prevents FREE users from accessing premium API endpoints.
 */

import { NextResponse } from 'next/server';

export interface SubscriptionValidationResult {
  isValid: boolean;
  user?: any;
  error?: string;
}

/**
 * Check if API request is from a paid user
 * Used in API route handlers to gate features
 */
export async function validatePaidSubscription(userFromAuth: any): Promise<SubscriptionValidationResult> {
  if (!userFromAuth) {
    return {
      isValid: false,
      error: 'User not authenticated'
    };
  }

  const isPaid = userFromAuth.payment_status === 'paid';
  const isActive = userFromAuth.subscription_status === 'active';

  if (!isPaid || !isActive) {
    return {
      isValid: false,
      error: 'This feature requires an active paid subscription'
    };
  }

  return {
    isValid: true,
    user: userFromAuth
  };
}

/**
 * Check if API request has permission for a specific feature
 */
export async function validateFeatureAccess(userFromAuth: any, feature: 'agents' | 'integrations' | 'automation' | 'instagram'): Promise<SubscriptionValidationResult> {
  // First validate paid subscription
  const paidValidation = await validatePaidSubscription(userFromAuth);
  if (!paidValidation.isValid) {
    return paidValidation;
  }

  // Check feature-specific limits
  switch (feature) {
    case 'agents':
      if (!userFromAuth.plan_limits?.hasAiResponses) {
        return {
          isValid: false,
          error: 'AI agent creation is not available on your plan'
        };
      }
      break;

    case 'instagram':
      if (!userFromAuth.plan_limits?.hasInstagram) {
        return {
          isValid: false,
          error: 'Instagram integration requires Pro or Enterprise plan'
        };
      }
      break;

    case 'integrations':
    case 'automation':
      // These require paid subscription (already validated above)
      break;
  }

  return {
    isValid: true,
    user: userFromAuth
  };
}

/**
 * Return a 403 Forbidden response with subscription error
 */
export function forbiddenSubscriptionError(message?: string) {
  return NextResponse.json(
    {
      error: message || 'This feature requires a paid subscription',
      code: 'SUBSCRIPTION_REQUIRED'
    },
    { status: 403 }
  );
}
