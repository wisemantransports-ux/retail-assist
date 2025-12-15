import { NextResponse } from 'next/server';
import { capturePayment } from '@/lib/paypal/billing';
import { recordBillingPayment, recordBillingEvent, updateSubscriptionBilling, insertSystemLog } from '@/lib/supabase/queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * PayPal Capture Endpoint
 * Called after user approves order on PayPal checkout
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, workspaceId, subscriptionId } = body;

    if (!orderId || !workspaceId) {
      return NextResponse.json({ error: 'orderId and workspaceId are required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Capture the order
    const captureRes = await capturePayment(orderId);
    if (!captureRes.success) {
      await insertSystemLog('error', workspaceId, userId, 'paypal_capture', 'Capture failed', { orderId, error: captureRes.error });
      return NextResponse.json({ error: 'Capture failed' }, { status: 400 });
    }

    // Extract payment details
    const amount = parseFloat(captureRes.amount || '0');
    const currency = captureRes.currency || 'USD';

    // Record billing payment
    if (subscriptionId) {
      const paymentRes = await recordBillingPayment(
        subscriptionId,
        workspaceId,
        amount,
        currency,
        'paypal',
        captureRes.captureId,
        { order_id: orderId, status: captureRes.status }
      );

      if (!paymentRes.error && paymentRes.data) {
        // Update subscription to active
        await updateSubscriptionBilling(subscriptionId, { status: 'active', last_payment_date: new Date().toISOString() });
        await recordBillingEvent(workspaceId, 'payment_received', subscriptionId, paymentRes.data?.id, {
          paypal_order_id: orderId,
          amount,
        });
      }
    }

    await insertSystemLog('info', workspaceId, userId, 'paypal_capture', 'Order captured', { orderId, amount });

    return NextResponse.json({
      success: true,
      orderId,
      amount,
      currency,
    });
  } catch (e) {
    console.error('Error in paypal/capture:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
