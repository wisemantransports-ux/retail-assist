import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createPayPalOrder } from '@/lib/paypal/server';
import { createPayment } from '@/lib/supabase/queries';

/**
 * POST /api/payments/paypal/create
 * Create a PayPal order for payment
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

    const { amount, currency = 'USD', workspaceId } = await req.json();

    // Validate input
    if (!amount || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, workspaceId' },
        { status: 400 }
      );
    }

    // Verify user is in workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    // Get app URL for return/cancel
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
    const returnUrl = `${baseUrl}/dashboard/billing?status=success`;
    const cancelUrl = `${baseUrl}/dashboard/billing?status=cancelled`;

    // Create PayPal order
    const paypalResult = await createPayPalOrder(amount.toString(), currency, returnUrl, cancelUrl);
    if (!paypalResult.success) {
      return NextResponse.json(
        { error: 'Failed to create PayPal order', details: paypalResult.error },
        { status: 500 }
      );
    }

    // Save to database
    const dbResult = await createPayment(workspaceId, user.id, amount, 'paypal', {
      paypal_order_id: paypalResult.id,
      currency,
    });

    if (dbResult.error) {
      return NextResponse.json({ error: 'Failed to save payment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orderId: paypalResult.id,
      approvalUrl: paypalResult.approvalUrl,
      paymentId: dbResult.data?.id,
    });
  } catch (error) {
    console.error('[paypal/create] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
