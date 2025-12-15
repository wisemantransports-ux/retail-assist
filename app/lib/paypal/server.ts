import { env } from '../env';
import { getBrand } from '@/config/branding';

/**
 * Simple PayPal REST API wrapper (server-side)
 * - Supports token retrieval
 * - Create subscription
 * - Verify webhook signatures
 *
 * Note: In mock mode this returns simulated responses. Configure the following env vars:
 * - PAYPAL_CLIENT_ID
 * - PAYPAL_CLIENT_SECRET
 * - PAYPAL_WEBHOOK_ID
 * - PAYPAL_API_BASE (optional, defaults to sandbox base)
 */

async function getAccessToken(): Promise<string | null> {
  if (env.useMockMode) {
    console.log('[PayPal] Mock mode: returning fake access token');
    return 'mock_access_token';
  }

  const clientId = env.paypal.clientId;
  const clientSecret = env.paypal.clientSecret;
  const apiBase = env.paypal.apiBase || 'https://api-m.sandbox.paypal.com';

  if (!clientId || !clientSecret) {
    console.warn('[PayPal] Missing client credentials');
    return null;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

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

  const json = await resp.json();
  return json.access_token;
}

export async function createPayPalSubscription(planId: string, returnUrl: string, cancelUrl: string) {
  if (env.useMockMode) {
    // Return a simulated approval URL and id
    const id = `I-MOCK-${Date.now()}`;
    return {
      success: true,
      id,
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${id}`,
    };
  }

  const apiBase = env.paypal.apiBase || 'https://api-m.sandbox.paypal.com';
  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No access token' };

  const brandConfig = getBrand();
  const body = {
    plan_id: planId,
    application_context: {
      brand_name: brandConfig.name,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const resp = await fetch(`${apiBase}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error('[PayPal] create subscription failed', resp.status, json);
    return { success: false, error: json };
  }

  // Extract approval link
  const approval = (json.links || []).find((l: any) => l.rel === 'approve');
  return { success: true, id: json.id, approvalUrl: approval?.href, raw: json };
}

export async function verifyPayPalWebhook(headers: Record<string, string>, body: string) {
  if (env.useMockMode) {
    console.log('[PayPal] Mock verify webhook: passing');
    return true;
  }

  // PayPal webhook verification using /v1/notifications/verify-webhook-signature
  const apiBase = env.paypal.apiBase || 'https://api-m.sandbox.paypal.com';
  const token = await getAccessToken();
  if (!token) return false;

  const verifyBody = {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: env.paypal.webhookId,
    webhook_event: JSON.parse(body),
  };

  const resp = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyBody),
  });

  if (!resp.ok) {
    console.error('[PayPal] verify webhook request failed', resp.status);
    return false;
  }

  const json = await resp.json();
  return json.verification_status === 'SUCCESS';
}

// ============================================================================
// ORDER-BASED CHECKOUT (NEW for Feature 9)
// ============================================================================

export async function createPayPalOrder(
  amount: string,
  currency: string = 'USD',
  returnUrl: string,
  cancelUrl: string
) {
  if (env.useMockMode) {
    const id = `MOCK-ORDER-${Date.now()}`;
    return {
      success: true,
      id,
      status: 'CREATED',
    };
  }

  const apiBase = env.paypal.apiBase || 'https://api-m.sandbox.paypal.com';
  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No access token' };

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount,
        },
      },
    ],
    application_context: {
      brand_name: getBrand().name,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      user_action: 'PAY_NOW',
    },
  };

  const resp = await fetch(`${apiBase}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error('[PayPal] create order failed', resp.status, json);
    return { success: false, error: json };
  }

  // Find approval link
  const approvalLink = (json.links || []).find((l: any) => l.rel === 'approve');
  return {
    success: true,
    id: json.id,
    status: json.status,
    approvalUrl: approvalLink?.href,
  };
}

export async function capturePayPalOrder(orderId: string) {
  if (env.useMockMode) {
    return {
      success: true,
      id: `MOCK-CAPTURE-${Date.now()}`,
      status: 'COMPLETED',
      orderId,
    };
  }

  const apiBase = env.paypal.apiBase || 'https://api-m.sandbox.paypal.com';
  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No access token' };

  const resp = await fetch(`${apiBase}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error('[PayPal] capture order failed', resp.status, json);
    return { success: false, error: json };
  }

  // Extract capture details
  const purchaseUnit = json.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  return {
    success: true,
    id: capture?.id,
    status: capture?.status,
    orderId: json.id,
    amount: purchaseUnit?.amount?.value,
    currency: purchaseUnit?.amount?.currency_code,
  };
}
