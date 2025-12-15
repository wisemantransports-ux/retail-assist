import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { verifyPayPalWebhook, capturePayment } from '@/lib/paypal/billing';
import { recordPaymentSuccess, recordBillingEvent, updateSubscriptionBilling } from '@/lib/supabase/queries';
import { env } from '@/lib/env';

/**
 * POST /api/billing/paypal/webhook
 * Handle PayPal webhook events (payment confirmations, disputes, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminSupabaseClient();
    const body = await req.text();

    // Verify webhook signature
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const isValid = await verifyPayPalWebhook(headers, body);
    if (!isValid && !env.useMockPayments) {
      console.warn('[paypal-webhook] Invalid signature, rejecting webhook');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body) as any;
    const eventType = event.event_type;

    console.log('[paypal-webhook] Received event:', eventType);

    // Handle different PayPal event types
    switch (eventType) {
      case 'CHECKOUT.ORDER.COMPLETED': {
        // User approved payment order, ready to capture
        const orderId = event.resource?.id;
        console.log('[paypal-webhook] Order completed:', orderId);
        // Note: actual capture happens in separate API call after user returns
        break;
      }

      case 'CHECKOUT.ORDER.APPROVED': {
        // Order was approved by user
        const orderId = event.resource?.id;
        console.log('[paypal-webhook] Order approved:', orderId);
        break;
      }

      case 'PAYMENT.CAPTURE.COMPLETED': {
        // Payment was successfully captured
        const captureId = event.resource?.id;
        const status = event.resource?.status;
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;

        console.log('[paypal-webhook] Payment captured:', {
          captureId,
          status,
          orderId,
        });

        // Find corresponding payment record
        if (orderId) {
          const { data: payment } = await supabase
            .from('billing_payments')
            .select('*')
            .eq('metadata->>paypal_order_id', orderId)
            .single();

          if (payment && status === 'COMPLETED') {
            // Update payment status
            await supabase
              .from('billing_payments')
              .update({
                status: 'completed',
                transaction_id: captureId,
                metadata: {
                  ...payment.metadata,
                  paypal_capture_id: captureId,
                  captured_at: new Date().toISOString(),
                },
              })
              .eq('id', payment.id);

            // Update subscription to active
            await updateSubscriptionBilling(payment.subscription_id, {
              status: 'active',
              last_payment_date: new Date().toISOString(),
            });

            console.log('[paypal-webhook] Payment confirmed and subscription activated');
          }
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        // Payment was refunded
        const captureId = event.resource?.id;
        const refundId = event.resource?.supplementary_data?.related_ids?.refund_id;

        console.log('[paypal-webhook] Refund processed:', {
          captureId,
          refundId,
        });

        // Find and update payment
        const { data: payment } = await supabase
          .from('billing_payments')
          .select('*')
          .eq('transaction_id', captureId)
          .single();

        if (payment) {
          await supabase
            .from('billing_payments')
            .update({
              status: 'refunded',
              metadata: {
                ...payment.metadata,
                refund_id: refundId,
                refunded_at: new Date().toISOString(),
              },
            })
            .eq('id', payment.id);

          // Record event
          await recordBillingEvent(
            payment.workspace_id,
            'payment_refunded',
            payment.subscription_id,
            payment.id,
            { refund_id: refundId }
          );
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED': {
        // Payment capture was denied
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
        console.log('[paypal-webhook] Payment denied:', orderId);

        // Find and update payment
        const { data: payment } = await supabase
          .from('billing_payments')
          .select('*')
          .eq('metadata->>paypal_order_id', orderId)
          .single();

        if (payment) {
          await supabase
            .from('billing_payments')
            .update({
              status: 'failed',
              metadata: {
                ...payment.metadata,
                failure_reason: event.resource?.status_details?.reason,
              },
            })
            .eq('id', payment.id);

          // Record event
          await recordBillingEvent(
            payment.workspace_id,
            'payment_failed',
            payment.subscription_id,
            payment.id,
            { reason: event.resource?.status_details?.reason }
          );
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CREATED': {
        // Subscription was created
        const subscriptionId = event.resource?.id;
        console.log('[paypal-webhook] Subscription created:', subscriptionId);
        break;
      }

      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        // Subscription is now active
        const subscriptionId = event.resource?.id;
        console.log('[paypal-webhook] Subscription activated:', subscriptionId);
        break;
      }

      case 'BILLING.SUBSCRIPTION.UPDATED': {
        // Subscription was updated
        const subscriptionId = event.resource?.id;
        console.log('[paypal-webhook] Subscription updated:', subscriptionId);
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        // Subscription was cancelled
        const subscriptionId = event.resource?.id;
        console.log('[paypal-webhook] Subscription cancelled:', subscriptionId);

        // Update local subscription record
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('provider_subscription_id', subscriptionId)
          .single();

        if (subscription) {
          await updateSubscriptionBilling(subscription.id, {
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          });

          await recordBillingEvent(
            subscription.workspace_id,
            'subscription_cancelled',
            subscription.id,
            undefined,
            { reason: 'Cancelled via PayPal webhook' }
          );
        }
        break;
      }

      default:
        console.log('[paypal-webhook] Unhandled event type:', eventType);
    }

    // Always return 200 OK to prevent PayPal retries
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[paypal-webhook] Error processing webhook:', error);
    // Still return 200 to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
