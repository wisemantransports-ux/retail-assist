import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { sessionManager } from '../../../lib/session';
import { ensureInternalUser } from '@/lib/supabase/queries';
import { ensureWorkspaceForUser } from '@/lib/supabase/ensureWorkspaceForUser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
    const supabaseAdmin = getSupabaseAdmin();
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

    // ===== SUPER ADMIN ELIGIBILITY CHECK =====
    // Server-side logic: Determine if this signup should create a super_admin role
    // Currently uses ENV flag: SUPER_ADMIN_EMAIL for hardcoded super admin email
    // Future: Replace with more sophisticated eligibility logic (invite codes, API keys, etc.)
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || '';
    const isSuperAdmin = email.toLowerCase() === superAdminEmail.toLowerCase() && superAdminEmail !== '';
    
    console.info('[SIGNUP] Super admin eligibility check:', {
      email,
      superAdminEmail,
      isSuperAdmin,
      envConfigured: !!process.env.SUPER_ADMIN_EMAIL
    });

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
        p_is_super_admin: isSuperAdmin,
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
    let workspaceId: string | null = null
    try {
      console.info('[SIGNUP] Calling ensureInternalUser with auth UID:', newUser.id)
      const ensured = await ensureInternalUser(newUser.id)
      console.info('[SIGNUP] ensureInternalUser returned:', ensured)
      internalUserId = (ensured && ensured.id) || (profile && profile.id) || null
      if (!internalUserId) {
        console.error('[SIGNUP] Could not resolve internal user id for:', newUser.id)
      } else {
        // Create session with the internal user ID (the canonical ID)
        session = await sessionManager.create(internalUserId, 24 * 7);
        console.info('[SIGNUP] Session created for internal user:', internalUserId);
      }
    } catch (sessionErr) {
      console.error('[SIGNUP] Failed to create session (non-fatal):', sessionErr);
    }

    // ===== CLIENT ADMIN ONBOARDING COMPLETION =====
    // For new signups (not super_admin): Create workspace if needed
    if (internalUserId && !isSuperAdmin) {
      try {
        console.info('[SIGNUP] Client admin signup detected - provisioning workspace');
        const workspaceResult = await ensureWorkspaceForUser(newUser.id);
        
        if (workspaceResult.error) {
          console.warn('[SIGNUP] Workspace provisioning failed (non-fatal):', workspaceResult.error);
        } else {
          workspaceId = workspaceResult.workspaceId;
          console.info('[SIGNUP] ✓ Workspace provisioned for admin:', workspaceId, 'created:', workspaceResult.created);
        }
      } catch (err: any) {
        console.warn('[SIGNUP] Workspace provisioning error (non-fatal):', err.message);
      }
    }

    // Build the JSON response and attach the session cookie so the client
    // receives the cookie in the same response that indicates success.
    const response = NextResponse.json({
      success: true,
      user: profile,
      internalUserId: internalUserId,
      workspaceId: workspaceId,
      message: 'Account created successfully.',
      rpcWarning: rpcError ? (rpcError.message || String(rpcError)) : null,
    });

    // Set custom session cookie if session was created
    if (session?.id) {
      const maxAge = 7 * 24 * 60 * 60
      response.cookies.set('session_id', session.id, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: maxAge
      })
      console.log('[SIGNUP] Session cookie set:', session.id)
    }

    return response;
  } catch (err) {
    console.error('[SIGNUP] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected signup error' }, { status: 500 })
  }
}