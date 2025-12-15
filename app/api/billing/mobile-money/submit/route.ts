import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { saveMobileMoneyPayment } from '@/lib/supabase/queries';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phoneNumber, receiptUrl, amount, currency } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Missing phoneNumber' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const workspaceId = (user.user_metadata?.workspace_id as string) || '';

    const saved = await saveMobileMoneyPayment({
      workspace_id: workspaceId,
      user_id: user.id,
      phone_number: phoneNumber,
      receipt_url: receiptUrl,
      amount: amount ? Number(amount) : undefined,
      currency: currency || 'USD',
    });

    if (!saved) {
      return NextResponse.json({ error: 'Failed to save payment' }, { status: 500 });
    }

    return NextResponse.json({ payment: saved });
  } catch (err: any) {
    console.error('Error submitting mobile money payment:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
