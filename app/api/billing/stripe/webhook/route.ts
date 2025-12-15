import { NextResponse } from 'next/server';
import { verifyStripeWebhookSignature } from '@/lib/stripe/billing';
import { updateSubscriptionBilling, recordBillingPayment, recordBillingEvent, insertSystemLog } from '@/lib/supabase/queries';
import { env } from '@/lib/env';

/**
 * Stripe Webhook Handler
 * Processes events: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted,
 * invoice.payment_succeeded, invoice.payment_failed
 */
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') || '';

  // Verify webhook signature
  if (!verifyStripeWebhookSignature(body, signature)) {
    console.warn('[stripe] Invalid webhook signature');
    // In mock mode, we skip verification
    if (!env.useMockPayments) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  try {
    const event = JSON.parse(body);
    const eventType = event.type;
    const data = event.data.object;

    console.log(`[stripe] Processing event: ${eventType}`);

    switch (eventType) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(data);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(data);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(data);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(data);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(data);
        break;

      default:
        console.log(`[stripe] Unhandled event type: ${eventType}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[stripe] Webhook processing error:', e);
    await insertSystemLog('error', null, null, 'stripe_webhook', 'Webhook processing failed', { error: String(e) });
    // Still return 200 to prevent Stripe retries
    return NextResponse.json({ received: true });
  }
}

async function handleSubscriptionCreated(subscription: any) {
  const workspaceId = subscription.metadata?.workspace_id;
  if (!workspaceId) {
    console.warn('[stripe] No workspace_id in subscription metadata');
    return;
  }

  console.log(`[stripe] Subscription created: ${subscription.id} for workspace ${workspaceId}`);

  // TODO: Update subscriptions table with Stripe subscription ID and metadata
  // For now just log
  await insertSystemLog('info', workspaceId, null, 'stripe_webhook', 'Subscription created', {
    subscriptionId: subscription.id,
    status: subscription.status,
  });
}

async function handleSubscriptionUpdated(subscription: any) {
  const workspaceId = subscription.metadata?.workspace_id;
  if (!workspaceId) {
    console.warn('[stripe] No workspace_id in subscription metadata');
    return;
  }

  console.log(`[stripe] Subscription updated: ${subscription.id}`);

  // Map Stripe status to our status
  const status = subscription.status === 'active' ? 'active' : 'past_due';

  // TODO: Find subscription by workspace_id and Stripe subscription ID, then update
  await insertSystemLog('info', workspaceId, null, 'stripe_webhook', 'Subscription updated', {
    subscriptionId: subscription.id,
    status,
  });
}

async function handleSubscriptionDeleted(subscription: any) {
  const workspaceId = subscription.metadata?.workspace_id;
  if (!workspaceId) {
    console.warn('[stripe] No workspace_id in subscription metadata');
    return;
  }

  console.log(`[stripe] Subscription cancelled: ${subscription.id}`);

  // TODO: Find subscription and mark as cancelled
  await insertSystemLog('info', workspaceId, null, 'stripe_webhook', 'Subscription deleted', {
    subscriptionId: subscription.id,
  });
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  const subscriptionId = invoice.subscription;
  const workspaceId = invoice.metadata?.workspace_id;

  if (!subscriptionId || !workspaceId) {
    console.warn('[stripe] Missing subscription or workspace in invoice');
    return;
  }

  console.log(`[stripe] Invoice paid: ${invoice.id}`);

  // Record billing payment
  await recordBillingPayment(
    subscriptionId,
    workspaceId,
    invoice.amount_paid / 100, // Convert from cents
    invoice.currency.toUpperCase(),
    'stripe',
    invoice.id,
    { invoice_id: invoice.id, status: invoice.status }
  );

  // Record event
  await recordBillingEvent(workspaceId, 'payment_received', subscriptionId, undefined, {
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_paid / 100,
  });

  await insertSystemLog('info', workspaceId, null, 'stripe_webhook', 'Invoice paid', {
    invoiceId: invoice.id,
    amount: invoice.amount_paid / 100,
  });
}

async function handleInvoicePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  const workspaceId = invoice.metadata?.workspace_id;

  if (!subscriptionId || !workspaceId) {
    console.warn('[stripe] Missing subscription or workspace in invoice');
    return;
  }

  console.log(`[stripe] Invoice payment failed: ${invoice.id}`);

  // TODO: Update subscription to 'past_due' or apply grace period
  await recordBillingEvent(workspaceId, 'payment_failed', subscriptionId, undefined, {
    stripe_invoice_id: invoice.id,
    reason: invoice.last_finalization_error?.message || 'Unknown',
  });

  await insertSystemLog('warning', workspaceId, null, 'stripe_webhook', 'Invoice payment failed', {
    invoiceId: invoice.id,
  });
}
