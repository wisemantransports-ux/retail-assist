import { NextResponse } from 'next/server';
import { verifyPayPalWebhook } from '@/lib/paypal/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { updateSubscriptionStatus, getSubscriptionByProviderId } from '@/lib/supabase/queries';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Collect necessary headers for verification
    const headers: Record<string, string> = {
      'paypal-transmission-id': request.headers.get('paypal-transmission-id') || '',
      'paypal-transmission-time': request.headers.get('paypal-transmission-time') || '',
      'paypal-cert-url': request.headers.get('paypal-cert-url') || '',
      'paypal-auth-algo': request.headers.get('paypal-auth-algo') || '',
      'paypal-transmission-sig': request.headers.get('paypal-transmission-sig') || '',
    };

    const ok = await verifyPayPalWebhook(headers, rawBody);
    if (!ok) {
      console.warn('[PayPal Webhook] Verification failed');
      if (!env.isDevelopment) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event_type || payload.eventType || payload.event;

    // Handle subscription lifecycle events
    if (!payload.resource) {
      return NextResponse.json({ ok: true });
    }

    const resource = payload.resource;
    // For subscription events resource.id typically contains subscription id
    const providerSubId = resource.id || resource.subscription_id || resource.billing_agreement_id;

    if (!providerSubId) {
      return NextResponse.json({ ok: true });
    }

    // Find subscription in DB
    const subscription = await getSubscriptionByProviderId(providerSubId);

    if (!subscription) {
      console.warn('[PayPal Webhook] Subscription not found for provider id:', providerSubId);
      return NextResponse.json({ ok: true });
    }

    // Map events to status changes
    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'PAYMENT.SALE.COMPLETED') {
      const nextBilling = resource.billing_info?.next_billing_time || resource.billing_info?.next_billing_date || null;
      await updateSubscriptionStatus(subscription.id, { status: 'active', next_billing_date: nextBilling });
      return NextResponse.json({ ok: true });
    }

    if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      await updateSubscriptionStatus(subscription.id, { status: 'cancelled', next_billing_date: null });
      return NextResponse.json({ ok: true });
    }

    // Other events: update metadata
    await updateSubscriptionStatus(subscription.id, { metadata: { last_event: payload } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[PayPal Webhook] Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
