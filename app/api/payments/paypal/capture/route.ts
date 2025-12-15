import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { capturePayPalOrder } from '@/lib/paypal/server';
import { updatePaymentStatus } from '@/lib/supabase/queries';

/**
 * POST /api/payments/paypal/capture
 * Capture a PayPal order after user approval
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, paymentId } = await req.json();

    // Validate input
    if (!orderId || !paymentId) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, paymentId' },
        { status: 400 }
      );
    }

    // Capture the order
    const captureResult = await capturePayPalOrder(orderId);
    if (!captureResult.success) {
      // Update payment to failed
      await updatePaymentStatus(paymentId, 'failed', {
        error: captureResult.error,
      });

      return NextResponse.json(
        { error: 'Failed to capture PayPal order', details: captureResult.error },
        { status: 500 }
      );
    }

    // Update payment to completed
    const dbResult = await updatePaymentStatus(paymentId, 'completed', {
      paypal_capture_id: captureResult.id,
      paypal_order_id: orderId,
      transaction_id: captureResult.id,
    });

    if (dbResult.error) {
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      captureId: captureResult.id,
      status: captureResult.status,
      amount: captureResult.amount,
    });
  } catch (error) {
    console.error('[paypal/capture] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
