import { NextResponse } from 'next/server';
import { replitDb, PLAN_LIMITS } from '@/lib/replit-db';
import { sessionManager } from '@/lib/replit-db/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    const user = await replitDb.users.authenticate(email, password);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Allow pending and suspended users to login - SubscriptionGuard will handle access control
    // Only block if truly inactive for other reasons
    
    await replitDb.logs.add({
      user_id: user.id,
      level: 'info',
      message: `User login: ${user.email}`
    });
    
    const session = sessionManager.create(user.id);
    const planLimits = PLAN_LIMITS[user.plan_type];
    
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        subscription_status: user.subscription_status,
        plan_type: user.plan_type,
        plan_name: planLimits.name,
        role: user.role,
        billing_end_date: user.billing_end_date
      }
    });
    
    response.cookies.set('session_id', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });
    
    return response;
  } catch (error: any) {
    console.error('[Auth Login] Error:', error.message);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
