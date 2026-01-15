import { NextResponse } from 'next/server';
import { db, PLAN_LIMITS } from '@/lib/db';
import { sessionManager } from '@/lib/session';
import { cookies } from 'next/headers';

async function verifyAdmin(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  if (!sessionId) return null;

  const session = await sessionManager.validate(sessionId);
  if (!session) return null;

  const user = await db.users.findById(session.user_id);
  if (!user || user.role !== 'super_admin') return null;

  return user;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const user = await db.users.findById(id);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tokens = await db.tokens.findByUserId(id);
    const planLimits = PLAN_LIMITS[user.plan_type];

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        phone: user.phone,
        plan_type: user.plan_type,
        plan_name: planLimits.name,
        subscription_status: user.subscription_status,
        billing_start_date: user.billing_start_date,
        billing_end_date: user.billing_end_date,
        paypal_subscription_id: user.paypal_subscription_id,
        role: user.role,
        created_at: user.created_at
      },
      tokens: tokens.map(t => ({
        id: t.id,
        platform: t.platform,
        page_id: t.page_id,
        page_name: t.page_name,
        created_at: t.created_at
      }))
    });
  } catch (error: any) {
    console.error('[Admin User Detail] Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
