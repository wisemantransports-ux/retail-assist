import { NextResponse } from 'next/server';
import { capturePayment } from '@/lib/paypal/billing';
import { recordBillingPayment, recordBillingEvent, updateSubscriptionBilling, insertSystemLog } from '@/lib/supabase/queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * PayPal Capture Endpoint
 * Called after user approves order on PayPal checkout
 */
export async function POST(req: Request) {
  return NextResponse.json({ error: 'Payment gateway disabled. Payments are currently disconnected.' }, { status: 503 });
}
