import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionManager } from '@/lib/session';
import { ensureWorkspaceForUser } from '@/lib/supabase/ensureWorkspaceForUser';
import { env } from '@/lib/env';
import { createServerClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

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
    
    let user: any = null
    if (env.useMockMode) {
      user = await db.users.create({
        email,
        password,
        business_name,
        phone,
        plan_type: selectedPlan
      })
    } else {
      // Production: create auth user via Supabase, then create profile row without storing passwords
      const supabase = createServerClient()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        console.error('[SIGNUP] Supabase signUp error:', error.message)
        if ((error as any)?.status === 409) {
          return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
      }
      if (!data || !data.user) {
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
      }

      const admin = await createAdminSupabaseClient()
      const now = new Date().toISOString()
      const profile = {
        id: data.user.id,
        email,
        business_name,
        phone,
        plan_type: selectedPlan,
        payment_status: 'unpaid',
        subscription_status: 'pending',
        role: 'user',
        created_at: now,
        updated_at: now
      }
      const { error: insertErr } = await admin.from('users').insert(profile)
      if (insertErr) {
        console.error('[SIGNUP] Failed to create profile row:', insertErr.message)
        // Not fatal for signup; continue
      }
      user = { id: data.user.id, email, business_name, phone, plan_type: selectedPlan }
    }
    
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

    // Attempt to ensure workspace exists (pass user id explicitly)
    try {
      await ensureWorkspaceForUser(user.id);
    } catch (wsErr) {
      console.warn('[SIGNUP] Workspace provisioning deferred to first login:', wsErr);
      // Workspace will be created on first login if not created here
    }

    // create a session so the user can immediately access the dashboard (free/limited)
    const session = await sessionManager.create(user.id);
    const maxAge = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000))
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
    const cookieStore = await cookies();
    cookieStore.set('session_id', session.id, { path: '/', httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge });
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
