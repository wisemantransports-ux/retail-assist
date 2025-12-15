import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rejectMobileMoneyPayment } from '@/lib/supabase/queries';

/**
 * POST /api/payments/mobile-money/admin/reject
 * Admin endpoint to reject a mobile money payment
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

    const { paymentId, reason } = await req.json();

    // Validate input
    if (!paymentId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentId, reason' },
        { status: 400 }
      );
    }

    // Get payment and verify user is admin/owner of workspace
    const { data: payment } = await supabase
      .from('mobile_money_payments')
      .select('workspace_id')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Check if user is workspace owner/admin
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', payment.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json({ error: 'Not authorized to reject payments' }, { status: 403 });
    }

    // Reject the payment
    const result = await rejectMobileMoneyPayment(paymentId, user.id, reason);

    if (result.error) {
      return NextResponse.json({ error: 'Failed to reject payment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      paymentId: result.data?.id,
      status: result.data?.status,
    });
  } catch (error) {
    console.error('[mobile-money/admin/reject] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
