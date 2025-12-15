/**
 * Stripe Billing Integration
 * Handles Stripe customer creation, checkout sessions, and webhook processing
 */

import { env } from '@/lib/env';

const STRIPE_BASE_URL = 'https://api.stripe.com/v1';

/**
 * Get Stripe secret key (placeholder for now; in prod use environment var)
 */
function getStripeSecretKey(): string {
  return env.stripeSecretKey || 'sk_test_placeholder';
}

/**
 * Get Stripe webhook secret
 */
function getStripeWebhookSecret(): string {
  return env.stripeWebhookSecret || 'whsec_test_placeholder';
}

/**
 * Make authenticated request to Stripe API
 */
async function stripeRequest(
  method: 'GET' | 'POST' | 'DELETE',
  endpoint: string,
  body?: Record<string, any>
) {
  if (env.useMockPayments) {
    // Mock mode: return simulated responses
    if (endpoint.includes('/customers')) {
      return { id: `cus_mock_${Math.random().toString(36).slice(2)}`, ...body };
    }
    if (endpoint.includes('/checkout/sessions')) {
      return { id: `cs_mock_${Math.random().toString(36).slice(2)}`, url: 'https://checkout.stripe.com/mock' };
    }
    if (endpoint.includes('/billing/portal/sessions')) {
      return { url: 'https://billing.stripe.com/mock' };
    }
    return { id: `mock_${Math.random().toString(36).slice(2)}` };
  }

  const secretKey = getStripeSecretKey();
  const auth = Buffer.from(`${secretKey}:`).toString('base64');

  const url = `${STRIPE_BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  if (body && (method === 'POST' || method === 'DELETE')) {
    options.body = new URLSearchParams(flattenObject(body)).toString();
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stripe API error: ${response.status} ${error}`);
    }
    return response.json();
  } catch (e) {
    console.error('[stripe] Request failed:', e);
    throw e;
  }
}

/**
 * Flatten nested object for URL-encoded body
 */
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        result[`${newKey}[${idx}]`] = item;
      });
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/**
 * Create a Stripe customer for a workspace
 */
export async function createStripeCustomer(
  workspaceId: string,
  email: string,
  name?: string
) {
  try {
    const customer = await stripeRequest('POST', '/customers', {
      email,
      name: name || `Workspace ${workspaceId}`,
      metadata: { workspace_id: workspaceId },
    });

    console.log('[stripe] Customer created:', customer.id);
    return { success: true, customerId: customer.id };
  } catch (e) {
    console.error('[stripe] Error creating customer:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Create a checkout session for a subscription
 */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  billingCycle: 'monthly' | 'yearly';
  quantity?: number;
  successUrl: string;
  cancelUrl: string;
  workspaceId?: string;
}) {
  try {
    const session = await stripeRequest('POST', '/checkout/sessions', {
      customer: params.customerId,
      mode: 'subscription',
      line_items: [
        {
          price: params.priceId,
          quantity: params.quantity || 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      subscription_data: {
        metadata: { workspace_id: params.workspaceId || '' },
        billing_cycle_anchor: Math.floor(Date.now() / 1000),
      },
    });

    console.log('[stripe] Checkout session created:', session.id);
    return { success: true, sessionId: session.id, url: session.url };
  } catch (e) {
    console.error('[stripe] Error creating checkout session:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  try {
    const session = await stripeRequest('POST', '/billing/portal/sessions', {
      customer: params.customerId,
      return_url: params.returnUrl,
    });

    console.log('[stripe] Portal session created:', session.id);
    return { success: true, url: session.url };
  } catch (e) {
    console.error('[stripe] Error creating portal session:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeWebhookSignature(
  body: string,
  signature: string
): boolean {
  if (env.useMockPayments) {
    console.log('[stripe] Mock mode: skipping webhook verification');
    return true;
  }

  try {
    const crypto = require('crypto');
    const webhookSecret = getStripeWebhookSecret();
    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(body, 'utf8')
      .digest('hex');
    const expectedSignature = `t=${Math.floor(Date.now() / 1000)},v1=${hash}`;
    
    // Parse signature
    const parts = signature.split(',');
    const signaturePart = parts.find(p => p.startsWith('v1='))?.slice(3);
    
    return signaturePart === hash;
  } catch (e) {
    console.error('[stripe] Webhook verification failed:', e);
    return false;
  }
}

/**
 * Retrieve a subscription from Stripe
 */
export async function getSubscription(subscriptionId: string) {
  try {
    const subscription = await stripeRequest('GET', `/subscriptions/${subscriptionId}`);
    return { success: true, data: subscription };
  } catch (e) {
    console.error('[stripe] Error retrieving subscription:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Cancel a subscription in Stripe
 */
export async function cancelSubscription(subscriptionId: string) {
  try {
    const result = await stripeRequest('DELETE', `/subscriptions/${subscriptionId}`);
    console.log('[stripe] Subscription cancelled:', subscriptionId);
    return { success: true, data: result };
  } catch (e) {
    console.error('[stripe] Error cancelling subscription:', e);
    return { success: false, error: String(e) };
  }
}
