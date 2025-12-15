import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { saveMobileMoneyPayment, createPayment } from '@/lib/supabase/queries';
import { generateReferenceCode, sendAdminNotificationEmail } from '@/lib/mobile-money/server';

/**
 * POST /api/payments/mobile-money/initiate
 * Initiate a mobile money payment (MTN, Vodacom, Airtel, etc.)
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

    const { amount, phoneNumber, workspaceId, currency = 'BWP' } = await req.json();

    // Validate input
    if (!amount || !phoneNumber || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, phoneNumber, workspaceId' },
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

    // Generate unique reference code
    const referenceCode = generateReferenceCode();

    // Save mobile money payment
    const result = await saveMobileMoneyPayment(
      workspaceId,
      user.id,
      phoneNumber,
      amount,
      referenceCode
    );

    if (result.error) {
      return NextResponse.json({ error: 'Failed to save payment' }, { status: 500 });
    }

    // Send admin notification
    await sendAdminNotificationEmail(phoneNumber, amount, referenceCode, workspaceId);

    return NextResponse.json({
      success: true,
      referenceCode,
      paymentId: result.data?.id,
      message: `Please send ${amount} ${currency} to the mobile money number provided. Reference: ${referenceCode}`,
    });
  } catch (error) {
    console.error('[mobile-money/initiate] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
