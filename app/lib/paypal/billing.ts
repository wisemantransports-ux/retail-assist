import { env } from '../env';
import { getBrand } from '@/config/branding';

/**
 * PayPal Billing & Subscription Helpers (server-side)
 * - Create payment order for one-time purchases
 * - Create subscription plan
 * - Execute/Capture payment
 * - Verify webhook signatures
 *
 * Supports mock mode: when NEXT_PUBLIC_USE_MOCK_PAYMENTS = true
 */

interface PayPalAccessTokenResponse {
  access_token: string;
  expires_in: number;
}

async function getAccessToken(): Promise<string | null> {
  if (env.useMockPayments) {
    console.log('[PayPal] Mock mode: returning fake access token');
    return 'mock_access_token_' + Date.now();
  }

  const clientId = env.paypal.clientId;
  const clientSecret = env.paypal.clientSecret;
  const apiBase = env.paypal.apiBase;

  if (!clientId || !clientSecret) {
    console.warn('[PayPal] Missing client credentials');
    return null;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const resp = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[PayPal] Failed to get access token', resp.status, text);
      return null;
    }

    const json = (await resp.json()) as PayPalAccessTokenResponse;
    return json.access_token;
  } catch (error) {
    console.error('[PayPal] Error getting access token:', error);
    return null;
  }
}

// ============================================================================
// ONE-TIME PAYMENT (for non-subscription purchases)
// ============================================================================

interface CreatePaymentOrderParams {
  amount: string;
  currency?: string;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
}

export async function createPaymentOrder(params: CreatePaymentOrderParams) {
  if (env.useMockPayments) {
    const orderId = `MOCK-ORDER-${Date.now()}`;
    return {
      success: true,
      orderId,
      status: 'CREATED',
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
    };
  }

  const apiBase = env.paypal.apiBase;
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'Failed to get access token' };
  }

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `order-${Date.now()}`,
        amount: {
          currency_code: params.currency || 'USD',
          value: params.amount,
        },
        description: params.description || 'Subscription Payment',
      },
    ],
    application_context: {
      brand_name: getBrand().name,
      landing_page: 'LOGIN',
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
      user_action: 'PAY_NOW',
    },
  };

  try {
    const resp = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `order-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });

    const json = await resp.json() as any;

    if (!resp.ok) {
      console.error('[PayPal] Create order failed:', resp.status, json);
      return { success: false, error: json.message || 'Failed to create order' };
    }

    const approvalLink = (json.links || []).find((l: any) => l.rel === 'approve');
    return {
      success: true,
      orderId: json.id,
      status: json.status,
      approvalUrl: approvalLink?.href,
    };
  } catch (error) {
    console.error('[PayPal] Error creating order:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// CAPTURE PAYMENT
// ============================================================================

export async function capturePayment(orderId: string) {
  if (env.useMockPayments) {
    return {
      success: true,
      captureId: `MOCK-CAPTURE-${Date.now()}`,
      status: 'COMPLETED',
      orderId,
    };
  }

  const apiBase = env.paypal.apiBase;
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'Failed to get access token' };
  }

  try {
    const resp = await fetch(`${apiBase}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const json = await resp.json() as any;

    if (!resp.ok) {
      console.error('[PayPal] Capture failed:', resp.status, json);
      return { success: false, error: json.message || 'Failed to capture order' };
    }

    const purchaseUnit = json.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];

    if (!capture) {
      return { success: false, error: 'No capture details in response' };
    }

    return {
      success: true,
      captureId: capture.id,
      status: capture.status,
      orderId: json.id,
      amount: purchaseUnit?.amount?.value,
      currency: purchaseUnit?.amount?.currency_code,
    };
  } catch (error) {
    console.error('[PayPal] Error capturing order:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

export async function verifyPayPalWebhook(
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  if (env.useMockPayments) {
    console.log('[PayPal] Mock mode: webhook verification passed');
    return true;
  }

  const apiBase = env.paypal.apiBase;
  const token = await getAccessToken();
  if (!token) {
    console.error('[PayPal] Cannot verify webhook: no access token');
    return false;
  }

  const verifyBody = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: env.paypal.webhookId,
    webhook_event: JSON.parse(body),
  };

  try {
    const resp = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyBody),
    });

    if (!resp.ok) {
      console.error('[PayPal] Webhook verification request failed:', resp.status);
      return false;
    }

    const json = (await resp.json()) as any;
    return json.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('[PayPal] Error verifying webhook:', error);
    return false;
  }
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT (future enhancement)
// ============================================================================

interface CreateSubscriptionPlanParams {
  planId: string;
  name: string;
  description?: string;
  billingCycles: {
    frequency: { interval_unit: 'MONTH' | 'YEAR'; interval: number };
    tenure_type: 'TRIAL' | 'REGULAR';
    sequence: number;
    total_cycles?: number;
    pricing_scheme: { fixed_price: { value: string; currency_code: string } };
  }[];
  paymentPreferences?: {
    auto_bill_amount: 'YES' | 'NO';
    setup_fee?: { value: string; currency_code: string };
    setup_fee_failure_action: 'CANCEL' | 'CONTINUE';
    payment_failure_threshold: number;
  };
}

export async function createSubscriptionPlan(params: CreateSubscriptionPlanParams) {
  if (env.useMockPayments) {
    const planId = `MOCK-PLAN-${Date.now()}`;
    console.log('[PayPal] Mock mode: subscription plan created', planId);
    return { success: true, planId };
  }

  // Placeholder for future full implementation
  console.log('[PayPal] Subscription plan creation not yet fully implemented');
  return {
    success: false,
    error: 'Subscription plan creation pending full implementation',
  };
}

/**
 * Create a subscription for a customer
 * TODO: Implement full PayPal subscription API integration
 */
export async function createSubscription(params: {
  planId: string;
  customerId?: string;
  startTime?: string;
  metadata?: Record<string, any>;
}) {
  if (env.useMockPayments) {
    const subscriptionId = `I-${Math.random().toString(36).slice(2).toUpperCase()}`;
    console.log('[PayPal] Mock mode: subscription created', subscriptionId);
    return { success: true, subscriptionId, status: 'APPROVAL_PENDING' };
  }

  console.log('[PayPal] Subscription creation pending full PayPal REST API integration');
  return { success: false, error: 'Not yet implemented' };
}

/**
 * Suspend a PayPal subscription
 */
export async function suspendSubscription(subscriptionId: string, reason?: string) {
  if (env.useMockPayments) {
    console.log('[PayPal] Mock mode: subscription suspended', subscriptionId);
    return { success: true };
  }

  console.log('[PayPal] Suspend subscription not yet implemented');
  return { success: false, error: 'Not yet implemented' };
}

/**
 * Cancel a PayPal subscription
 */
export async function cancelPayPalSubscription(subscriptionId: string, reason?: string) {
  if (env.useMockPayments) {
    console.log('[PayPal] Mock mode: subscription cancelled', subscriptionId);
    return { success: true };
  }

  console.log('[PayPal] Cancel subscription not yet implemented');
  return { success: false, error: 'Not yet implemented' };
}
