import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { confirmMobileMoneyPaymentBilling, updateSubscriptionBilling, recordBillingEvent } from '@/lib/supabase/queries';

/**
 * POST /api/billing/momo/confirm
 * Admin endpoint to confirm a mobile money payment and activate subscription
 *
 * Request body:
 * {
 *   paymentId: string;
 *   notes?: string;
 * }
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

    const { paymentId, notes } = await req.json();

    // Validate input
    if (!paymentId) {
      return NextResponse.json(
        { error: 'Missing required field: paymentId' },
        { status: 400 }
      );
    }

    // Get payment and verify user is admin/owner
    const { data: payment } = await supabase
      .from('momo_payments')
      .select('*, subscriptions(*)')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const workspaceId = payment.workspace_id;

    // Check if user is workspace owner/admin
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json({ error: 'Not authorized to confirm payments' }, { status: 403 });
    }

    // Confirm the payment
    const confirmResult = await confirmMobileMoneyPaymentBilling(paymentId, user.id, notes);

    if (confirmResult.error) {
      return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
    }

    // Activate the associated subscription
    const subscription = payment.subscriptions;
    if (subscription) {
      const activateResult = await updateSubscriptionBilling(subscription.id, {
        status: 'active',
        last_payment_date: new Date().toISOString(),
      });

      if (activateResult.error) {
        console.warn('[momo-confirm] Failed to activate subscription:', activateResult.error);
      }

      // Record billing event
      await recordBillingEvent(workspaceId, 'payment_confirmed', subscription.id, paymentId, {
        payment_method: 'momo',
        reference_code: payment.reference_code,
        confirmed_by: user.id,
        notes,
      });
    }

    return NextResponse.json({
      success: true,
      paymentId: confirmResult.data?.id,
      status: confirmResult.data?.status,
      subscriptionActivated: !!subscription,
    });
  } catch (error) {
    console.error('[momo-confirm] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
