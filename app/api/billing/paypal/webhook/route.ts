import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { verifyPayPalWebhook, capturePayment } from '@/lib/paypal/billing';
import { recordPaymentSuccess, recordBillingEvent, updateSubscriptionBilling } from '@/lib/supabase/queries';
import { env } from '@/lib/env';

/**
 * POST /api/billing/paypal/webhook
 * Handle PayPal webhook events (payment confirmations, disputes, etc.)
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'Payment gateway disabled. Webhooks are currently not processed.' }, { status: 503 });
}
