import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionManager } from '@/lib/session';
import { ensureWorkspaceForUser } from '@/lib/supabase/ensureWorkspaceForUser';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, business_name, phone, plan_type } = body;
    
    if (!email || !password || !business_name || !phone) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }
    
    const validPlans = ['starter', 'pro', 'enterprise'];
    const selectedPlan = validPlans.includes(plan_type) ? plan_type : 'starter';
    
    const user = await db.users.create({
      email,
      password,
      business_name,
      phone,
      plan_type: selectedPlan
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }
    
    // record signup as a lead for follow-up (business + phone + email)
    try {
      await db.logs.add({
        user_id: user.id,
        level: 'lead',
        message: `Lead captured: ${business_name} (${email})`,
        meta: { plan_type: selectedPlan, phone, business_name }
      });
    } catch (e: any) {
      // Non-fatal: logging should not prevent signup (e.g., mock mode without Supabase)
      console.warn('[SIGNUP] Failed to record lead log (non-fatal):', e?.message || e);
    }

    // keep an info log as well
    try {
      await db.logs.add({
        user_id: user.id,
        level: 'info',
        message: `New user signup: ${business_name} (${email})`,
        meta: { plan_type: selectedPlan }
      });
    } catch (e: any) {
      console.warn('[SIGNUP] Failed to record info log (non-fatal):', e?.message || e);
    }

    // Attempt to ensure workspace exists (safe to call, handles auth context)
    // Note: This is best-effort in signup context as auth might not be fully set up
    try {
      await ensureWorkspaceForUser();
    } catch (wsErr) {
      console.warn('[SIGNUP] Workspace provisioning deferred to first login:', wsErr);
      // Workspace will be created on first login if not created here
    }

    // create a session so the user can immediately access the dashboard (free/limited)
    const session = await sessionManager.create(user.id, 24 * 30);
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        subscription_status: user.subscription_status,
        plan_type: user.plan_type
      },
      message: 'Account created successfully. You can access the dashboard — upgrade to unlock premium features.'
    });
    res.cookies.set('session_id', session.id, { path: '/', httpOnly: true });
    return res;
  } catch (error: any) {
    console.error('[Auth Signup] Error:', error.message);
    
    if (error.message === 'Email already exists') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );

    }
    
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
