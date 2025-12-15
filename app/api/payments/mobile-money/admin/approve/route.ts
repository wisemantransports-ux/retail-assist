import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { approveMobileMoneyPayment } from '@/lib/supabase/queries';

/**
 * POST /api/payments/mobile-money/admin/approve
 * Admin endpoint to approve a mobile money payment
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
      return NextResponse.json({ error: 'Not authorized to approve payments' }, { status: 403 });
    }

    // Approve the payment
    const result = await approveMobileMoneyPayment(paymentId, user.id, notes);

    if (result.error) {
      return NextResponse.json({ error: 'Failed to approve payment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      paymentId: result.data?.id,
      status: result.data?.status,
    });
  } catch (error) {
    console.error('[mobile-money/admin/approve] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
