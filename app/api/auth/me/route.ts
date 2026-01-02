import { NextResponse } from 'next/server';
import { db, PLAN_LIMITS } from '@/lib/db';
import { sessionManager } from '@/lib/session';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const session = await sessionManager.validate(sessionId);
    if (!session) {
      const response = NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
      // Clear cookie using same path
      cookieStore.set('session_id', '', { path: '/', maxAge: 0, httpOnly: true, secure: env.isProduction, sameSite: 'lax' });
      return response;
    }
    
    const user = await db.users.findById(session.user_id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const planLimits = PLAN_LIMITS[user.plan_type];
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        phone: user.phone,
        payment_status: user.payment_status || 'unpaid',
        subscription_status: user.subscription_status,
        plan_type: user.plan_type,
        plan_name: planLimits.name,
        plan_limits: planLimits,
        billing_end_date: user.billing_end_date,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('[Auth Me] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
