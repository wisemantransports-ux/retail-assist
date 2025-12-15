import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createBillingPortalSession } from '@/lib/stripe/billing';
import { insertSystemLog } from '@/lib/supabase/queries';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

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

    // Fetch subscription to get Stripe customer ID
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    // TODO: Extract Stripe customer ID from metadata or separate field
    // For now, use a placeholder or metadata field
    const stripeCustomerId = subscription?.metadata?.stripe_customer_id || 'cus_placeholder';

    const returnUrl = `${new URL(req.url).origin}/dashboard/${workspaceId}/billing`;

    const portalRes = await createBillingPortalSession({
      customerId: stripeCustomerId,
      returnUrl,
    });

    if (!portalRes.success) {
      await insertSystemLog('error', workspaceId, userId, 'stripe_portal', 'Failed to create portal session', { error: portalRes.error });
      return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
    }

    await insertSystemLog('info', workspaceId, userId, 'stripe_portal', 'Portal session created');

    return NextResponse.json({ success: true, url: portalRes.url });
  } catch (e) {
    console.error('Error in stripe/portal:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
