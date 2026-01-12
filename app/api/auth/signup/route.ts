import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sessionManager } from '../../../lib/session';
import { ensureInternalUser } from '@/lib/supabase/queries';

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      email,
      password,
      business_name,
      phone,
      plan_type = 'starter',
      full_name = null,
    } = body

    // Validate required fields
    if (!email || !password || !business_name || !phone) {
      return NextResponse.json({ error: 'Missing required fields: email, password, business_name, phone' }, { status: 400 })
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(String(email).toLowerCase())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // 1) Create auth user using service-role client
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData?.user) {
      console.error('[SIGNUP] Auth error:', authError);
      return NextResponse.json({ error: authError?.message || 'Failed to create auth user' }, { status: 500 });
    }

    const newUser = authData.user;

    // 2) Best-effort: attempt to create profile via RPC but do NOT fail the
    // entire signup flow if the RPC fails. We always create a session and
    // return success when the auth user is created.
    let profile: any = null
    let rpcError: any = null
    try {
      const rpcCall: any = supabaseAdmin.rpc('rpc_create_user_profile', {
        p_auth_uid: newUser.id,
        p_business_name: business_name,
        p_email: email,
        p_phone: phone,
        p_full_name: full_name || null,
        p_plan_type: plan_type || 'starter',
      });

      console.info('[SIGNUP] RPC raw response:', rpcCall);
      const rpcRes = await rpcCall.single();
      profile = rpcRes?.data || null
      rpcError = rpcRes?.error || null
      if (rpcError) console.warn('[SIGNUP] Profile RPC returned error (non-fatal):', rpcError)
    } catch (e) {
      rpcError = e
      console.error('[SIGNUP] RPC threw exception (non-fatal):', e)
    }

    // 3) Ensure internal users row exists and create server session so user can access dashboard immediately
    let session: any = null;
    let internalUserId: string | null = null
    try {
      const ensured = await ensureInternalUser(newUser.id)
      internalUserId = (ensured && ensured.id) || (profile && profile.id) || null
      if (!internalUserId) {
        console.error('[SIGNUP] Could not resolve internal user id for:', newUser.id)
      } else {
        session = await sessionManager.create(internalUserId, 24 * 7);
        console.info('[SIGNUP] Session created for user:', internalUserId);
      }
    } catch (sessionErr) {
      console.error('[SIGNUP] Failed to create session (non-fatal):', sessionErr);
    }

    // Build the JSON response and attach the session cookie so the client
    // receives the cookie in the same response that indicates success.
    const response = NextResponse.json({
      success: true,
      user: profile,
      internalUserId: internalUserId,
      message: 'Account created successfully.',
      rpcWarning: rpcError ? (rpcError.message || String(rpcError)) : null,
    });

    if (session?.id) {
      try {
        const cookieStore = await cookies();
        cookieStore.set('session_id', session.id, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 })
      } catch (e) {
        console.warn('[SIGNUP] Could not set cookie via cookies():', e)
      }

      // Also set `Set-Cookie` header directly as a fallback for environments
      // where the cookie store does not attach headers to the response object.
      try {
        const maxAge = 7 * 24 * 60 * 60
        const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
        const cookieValue = `session_id=${session.id}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`
        try {
          response.headers.set('Set-Cookie', cookieValue)
        } catch (e) {
          // Some runtimes may not allow mutating headers this way; ignore silently.
          console.warn('[SIGNUP] Could not set Set-Cookie header directly:', e)
        }
      } catch (e) {
        console.warn('[SIGNUP] Failed to build/set fallback Set-Cookie header:', e)
      }
    }

    return response;
  } catch (err) {
    console.error('[SIGNUP] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected signup error' }, { status: 500 })
  }
}