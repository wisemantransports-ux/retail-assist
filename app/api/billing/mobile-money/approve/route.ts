import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { approveMobileMoneyPayment } from '@/lib/supabase/queries';

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const paymentId = form.get('paymentId') as string;

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });
    }

    // For admin approval we use the service role client
    const admin = await createAdminSupabaseClient();

    // Basic check: ensure payment exists
    const { data: payment, error } = await admin.from('mobile_money_payments').select('*').eq('id', paymentId).single();
    if (error || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Approve and optionally create subscription (basic: create active subscription for user with basic plan)
    const result = await approveMobileMoneyPayment(paymentId, /*adminId*/ null as any, { plan: 'mobile_money_basic', provider: 'mobile_money' });

    if (!result) {
      return NextResponse.json({ error: 'Failed to approve payment' }, { status: 500 });
    }

    // Redirect back to billing page in admin UI (browser form submit)
    return NextResponse.redirect('/dashboard/billing');
  } catch (err: any) {
    console.error('Error approving mobile money payment:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
