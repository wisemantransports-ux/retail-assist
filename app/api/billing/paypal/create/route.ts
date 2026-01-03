import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createPayPalSubscription } from '@/lib/paypal/server';
import { createSubscription } from '@/lib/supabase/queries';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  return NextResponse.json({ error: 'Payment gateway disabled. Payments are currently disconnected.' }, { status: 503 });
}
