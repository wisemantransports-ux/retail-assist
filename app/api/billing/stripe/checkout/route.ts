import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createStripeCustomer, createCheckoutSession, getSubscription } from '@/lib/stripe/billing';
import { getPlanById, insertSystemLog } from '@/lib/supabase/queries';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, planId, billingCycle } = body;

    if (!workspaceId || !planId) {
      return NextResponse.json({ error: 'workspaceId and planId are required' }, { status: 400 });
    }

    // Get current user & workspace info
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is workspace member
    const { data: member } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    // Get plan details
    const planRes = await getPlanById(planId);
    if (planRes.error || !planRes.data) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const plan = planRes.data;

    // TODO: In production, fetch or create Stripe customer_id from subscriptions table
    // For now, create a temporary customer for this checkout
    const customerRes = await createStripeCustomer(workspaceId, session.user.email || 'customer@example.com');
    if (!customerRes.success) {
      await insertSystemLog('error', workspaceId, userId, 'stripe_checkout', 'Failed to create Stripe customer', { error: customerRes.error });
      return NextResponse.json({ error: 'Failed to create billing customer' }, { status: 500 });
    }

    // TODO: Map plan to Stripe price ID
    // For demo: use placeholder
    const stripePriceId = plan.stripe_product_id ? `price_${plan.stripe_product_id}` : 'price_demo_monthly';

    const successUrl = `${new URL(req.url).origin}/dashboard/${workspaceId}/billing?success=true`;
    const cancelUrl = `${new URL(req.url).origin}/dashboard/${workspaceId}/billing?cancelled=true`;

    const sessionRes = await createCheckoutSession({
      customerId: customerRes.customerId,
      priceId: stripePriceId,
      billingCycle: (billingCycle as 'monthly' | 'yearly') || 'monthly',
      successUrl,
      cancelUrl,
      workspaceId,
    });

    if (!sessionRes.success) {
      await insertSystemLog('error', workspaceId, userId, 'stripe_checkout', 'Failed to create checkout session', { error: sessionRes.error });
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    await insertSystemLog('info', workspaceId, userId, 'stripe_checkout', 'Stripe checkout initiated', { planId, billingCycle });

    return NextResponse.json({
      success: true,
      sessionId: sessionRes.sessionId,
      url: sessionRes.url,
    });
  } catch (e) {
    console.error('Error in stripe/checkout:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
