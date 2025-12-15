import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createPaymentOrder } from '@/lib/paypal/billing';
import { getPlanById } from '@/lib/supabase/queries';

/**
 * POST /api/billing/checkout/paypal
 * Create a PayPal payment order for subscription
 *
 * Request body:
 * {
 *   planId: string;
 *   billingCycle: 'monthly' | 'yearly';
 *   workspaceId: string;
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

    const { planId, billingCycle = 'monthly', workspaceId } = await req.json();

    // Validate input
    if (!planId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, workspaceId' },
        { status: 400 }
      );
    }

    // Verify user is member of workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    // Get plan details
    const planResult = await getPlanById(planId);
    if (planResult.error || !planResult.data) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const plan = planResult.data;
    const amount =
      billingCycle === 'yearly' ? plan.price_yearly?.toString() : plan.price_monthly?.toString();

    if (!amount) {
      return NextResponse.json(
        { error: `No ${billingCycle} price available for this plan` },
        { status: 400 }
      );
    }

    // Create PayPal order
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
    const returnUrl = `${baseUrl}/dashboard/billing/checkout?orderId={orderId}&plan=${planId}&cycle=${billingCycle}&workspace=${workspaceId}`;
    const cancelUrl = `${baseUrl}/dashboard/billing?cancelled=true`;

    const paypalResult = await createPaymentOrder({
      amount,
      currency: 'USD',
      description: `${plan.display_name} - ${billingCycle} billing`,
      returnUrl,
      cancelUrl,
    });

    if (!paypalResult.success) {
      console.error('[paypal-checkout] Order creation failed:', paypalResult.error);
      return NextResponse.json(
        { error: 'Failed to create PayPal order', details: paypalResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: paypalResult.orderId,
      approvalUrl: paypalResult.approvalUrl,
      planId,
      amount,
      billingCycle,
      workspaceId,
    });
  } catch (error) {
    console.error('[paypal-checkout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
