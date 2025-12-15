import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createPayPalSubscription } from '@/lib/paypal/server';
import { createSubscription } from '@/lib/supabase/queries';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planId, returnUrl, cancelUrl } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Missing planId' }, { status: 400 });
    }

    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Build return/cancel URLs if not provided
    const appReturn = returnUrl || `${env.appUrl}/dashboard/billing`;
    const appCancel = cancelUrl || `${env.appUrl}/dashboard/billing`;

    const result = await createPayPalSubscription(planId, appReturn, appCancel);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create subscription' }, { status: 500 });
    }

    // Persist subscription as pending
    const saved = await createSubscription({
      workspace_id: (user.user_metadata?.workspace_id as string) || '',
      user_id: user.id,
      provider: 'paypal',
      provider_subscription_id: result.id,
      plan: planId,
      status: 'pending',
      next_billing_date: null,
    });

    return NextResponse.json({ approvalUrl: result.approvalUrl, subscription: saved });
  } catch (err: any) {
    console.error('Error creating PayPal subscription:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
