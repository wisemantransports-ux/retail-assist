import {
  createSubscription,
  updateSubscriptionBilling,
  recordBillingPayment,
  recordBillingEvent,
} from '../supabase/queries';
import type { Subscription, BillingPayment } from '../types/database';
import { env } from '../env';

/**
 * Core Billing Logic Functions (server-side)
 * - Activate subscriptions
 * - Record payments
 * - Apply renewal dates
 * - Cancel subscriptions
 * - Handle payment failures
 * - Apply grace periods
 */

/**
 * Activate a subscription for a workspace
 */
export async function activateSubscription(
  workspaceId: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly',
  provider: 'paypal' | 'stripe' | 'momo' | 'manual',
  providerSubscriptionId?: string
) {
  try {
    const result = await createSubscription({
      workspace_id: workspaceId,
      user_id: '', // Will be set by the caller
      provider,
      provider_subscription_id: providerSubscriptionId,
      plan: planId,
      status: 'active',
      next_billing_date: new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (result.error) {
      return { error: result.error, data: null };
    }

    // Record billing event
    await recordBillingEvent(workspaceId, 'subscription_created', result.data?.id, undefined, {
      plan_id: planId,
      billing_cycle: billingCycle,
      provider,
    });

    console.log('[billing:core] Subscription activated:', result.data?.id);
    return { error: null, data: result.data };
  } catch (error) {
    console.error('[billing:core] Error activating subscription:', error);
    return { error: String(error), data: null };
  }
}

/**
 * Record a successful payment
 */
export async function recordPaymentSuccess(
  subscriptionId: string,
  workspaceId: string,
  amount: number,
  currency: string,
  provider: 'paypal' | 'stripe' | 'momo' | 'manual',
  transactionId?: string
) {
  try {
    // Record the payment
    const paymentResult = await recordBillingPayment(
      subscriptionId,
      workspaceId,
      amount,
      currency,
      provider,
      transactionId
    );

    if (paymentResult.error) {
      return { error: paymentResult.error, data: null };
    }

    // Update subscription: set last_payment_date, clear grace period
    const updateResult = await updateSubscriptionBilling(subscriptionId, {
      last_payment_date: new Date().toISOString(),
      is_on_grace_period: false,
      grace_period_ends_at: null,
      status: 'active',
    });

    if (updateResult.error) {
      console.warn('[billing:core] Failed to update subscription after payment:', updateResult.error);
    }

    // Record billing event
    await recordBillingEvent(
      workspaceId,
      'payment_received',
      subscriptionId,
      paymentResult.data?.id,
      {
        amount,
        currency,
        provider,
        transaction_id: transactionId,
      }
    );

    console.log('[billing:core] Payment recorded:', paymentResult.data?.id);
    return { error: null, data: paymentResult.data };
  } catch (error) {
    console.error('[billing:core] Error recording payment:', error);
    return { error: String(error), data: null };
  }
}

/**
 * Apply renewal dates to a subscription
 */
export async function applyRenewalDates(subscription: Subscription): Promise<void> {
  try {
    const renewalDate = new Date(subscription.renewal_date || new Date());

    // Calculate next renewal
    if (subscription.billing_cycle === 'monthly') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else if (subscription.billing_cycle === 'yearly') {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    await updateSubscriptionBilling(subscription.id, {
      renewal_date: renewalDate.toISOString(),
      current_period_end: renewalDate.toISOString(),
    });

    console.log('[billing:core] Renewal dates applied:', subscription.id);
  } catch (error) {
    console.error('[billing:core] Error applying renewal dates:', error);
  }
}

/**
 * Handle payment failure
 */
export async function handlePaymentFailure(
  subscriptionId: string,
  workspaceId: string,
  reason: string
) {
  try {
    // Check if subscription should enter grace period
    const graceResult = await updateSubscriptionBilling(subscriptionId, {
      status: 'past_due',
      is_on_grace_period: true,
      grace_period_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (graceResult.error) {
      return { error: graceResult.error };
    }

    // Record billing event
    await recordBillingEvent(workspaceId, 'payment_failed', subscriptionId, undefined, {
      reason,
      grace_period_days: 7,
    });

    console.log('[billing:core] Payment failure recorded, grace period applied:', subscriptionId);
    return { error: null };
  } catch (error) {
    console.error('[billing:core] Error handling payment failure:', error);
    return { error: String(error) };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  workspaceId: string,
  reason?: string
) {
  try {
    const cancelResult = await updateSubscriptionBilling(subscriptionId, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    });

    if (cancelResult.error) {
      return { error: cancelResult.error };
    }

    // Record billing event
    await recordBillingEvent(workspaceId, 'subscription_cancelled', subscriptionId, undefined, {
      reason,
      cancelled_at: new Date().toISOString(),
    });

    console.log('[billing:core] Subscription cancelled:', subscriptionId);
    return { error: null, data: cancelResult.data };
  } catch (error) {
    console.error('[billing:core] Error cancelling subscription:', error);
    return { error: String(error), data: null };
  }
}

/**
 * Check if grace period has expired and should cancel subscription
 */
export async function checkGracePeriodExpiry(subscription: Subscription): Promise<boolean> {
  if (!subscription.is_on_grace_period || !subscription.grace_period_ends_at) {
    return false;
  }

  const now = new Date();
  const gracePeriodEnd = new Date(subscription.grace_period_ends_at);

  if (now > gracePeriodEnd) {
    // Grace period expired - cancel subscription
    console.log('[billing:core] Grace period expired for subscription:', subscription.id);
    return true;
  }

  return false;
}

/**
 * Pause a subscription (for administrative purposes)
 */
export async function pauseSubscription(
  subscriptionId: string,
  workspaceId: string,
  reason?: string
) {
  try {
    const pauseResult = await updateSubscriptionBilling(subscriptionId, {
      status: 'paused',
    });

    if (pauseResult.error) {
      return { error: pauseResult.error };
    }

    // Record billing event
    await recordBillingEvent(workspaceId, 'subscription_paused', subscriptionId, undefined, {
      reason,
    });

    console.log('[billing:core] Subscription paused:', subscriptionId);
    return { error: null, data: pauseResult.data };
  } catch (error) {
    console.error('[billing:core] Error pausing subscription:', error);
    return { error: String(error), data: null };
  }
}

/**
 * Resume a paused subscription
 */
export async function resumeSubscription(subscriptionId: string, workspaceId: string) {
  try {
    const resumeResult = await updateSubscriptionBilling(subscriptionId, {
      status: 'active',
    });

    if (resumeResult.error) {
      return { error: resumeResult.error };
    }

    // Record billing event
    await recordBillingEvent(workspaceId, 'subscription_resumed', subscriptionId);

    console.log('[billing:core] Subscription resumed:', subscriptionId);
    return { error: null, data: resumeResult.data };
  } catch (error) {
    console.error('[billing:core] Error resuming subscription:', error);
    return { error: String(error), data: null };
  }
}

/**
 * Upgrade subscription to a higher plan
 */
export async function upgradeSubscription(
  subscriptionId: string,
  workspaceId: string,
  newPlanId: string,
  prorationAmount?: number
) {
  try {
    const upgradeResult = await updateSubscriptionBilling(subscriptionId, {
      plan_id: newPlanId,
    });

    if (upgradeResult.error) {
      return { error: upgradeResult.error };
    }

    // Record billing event with proration details
    await recordBillingEvent(workspaceId, 'subscription_upgraded', subscriptionId, undefined, {
      new_plan_id: newPlanId,
      proration_amount: prorationAmount,
      upgraded_at: new Date().toISOString(),
    });

    console.log('[billing:core] Subscription upgraded:', subscriptionId);
    return { error: null, data: upgradeResult.data };
  } catch (error) {
    console.error('[billing:core] Error upgrading subscription:', error);
    return { error: String(error), data: null };
  }
}
