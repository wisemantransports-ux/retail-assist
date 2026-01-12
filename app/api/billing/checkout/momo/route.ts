import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateMobileMoneyReference, validatePhoneNumber, detectProvider } from '@/lib/mobile-money/billing';
import { createMobileMoneyPaymentBilling, getPlanById, ensureInternalUser } from '@/lib/supabase/queries';
import { recordBillingEvent } from '@/lib/supabase/queries';

/**
 * POST /api/billing/checkout/momo
 * Initiate a mobile money payment for subscription
 *
 * Request body:
 * {
 *   planId: string;
 *   phoneNumber: string;
 *   billingCycle: 'monthly' | 'yearly';
 *   workspaceId: string;
 *   provider?: 'mtn' | 'vodacom' | 'airtel';
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, phoneNumber, billingCycle = 'monthly', workspaceId, provider } = await req.json();

    // Validate input
    if (!planId || !phoneNumber || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, phoneNumber, workspaceId' },
        { status: 400 }
      );
    }

    // Resolve internal user id and verify membership in workspace
    const ensured = await ensureInternalUser(user.id)
    const internalUserId = ensured?.id || user.id
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', internalUserId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    // Validate phone number
    if (!validatePhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Get plan details
    const planResult = await getPlanById(planId);
    if (planResult.error || !planResult.data) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const plan = planResult.data;
    const amount =
      billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

    if (!amount) {
      return NextResponse.json(
        { error: `No ${billingCycle} price available for this plan` },
        { status: 400 }
      );
    }

    // Detect provider if not specified
    const detectedProvider = provider || detectProvider(phoneNumber);

    // Create subscription first
    const { data: subscription } = await supabase
      .from('subscriptions')
      .insert({
        workspace_id: workspaceId,
        plan_id: planId,
        status: 'pending',
        billing_cycle: billingCycle,
        provider: 'momo',
      })
      .select()
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

    // Generate reference code
    const referenceCode = generateMobileMoneyReference(detectedProvider as any);

    // Create mobile money payment record
    const momoResult = await createMobileMoneyPaymentBilling(
      subscription.id,
      workspaceId,
      phoneNumber,
      amount,
      referenceCode,
      detectedProvider as 'mtn' | 'vodacom' | 'airtel'
    );

    if (momoResult.error) {
      return NextResponse.json(
        { error: 'Failed to create mobile money payment' },
        { status: 500 }
      );
    }

    // Record billing event
    await recordBillingEvent(
      workspaceId,
      'momo_payment_initiated',
      subscription.id,
      undefined,
      {
        reference_code: referenceCode,
        phone_number: phoneNumber,
        provider: detectedProvider,
        amount,
        billing_cycle: billingCycle,
      }
    );

    // TODO: Send admin notification email with reference code

    return NextResponse.json({
      success: true,
      referenceCode,
      subscriptionId: subscription.id,
      paymentId: momoResult.data?.id,
      phoneNumber,
      provider: detectedProvider,
      amount,
      currency: 'BWP',
      message: `Please send ${amount} BWP to your ${detectedProvider.toUpperCase()} account with reference: ${referenceCode}`,
    });
  } catch (error) {
    console.error('[momo-checkout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
