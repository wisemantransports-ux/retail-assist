import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { sessionManager } from '../../../lib/session';

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

    // 2) Create profile via RPC (atomic DB-side behavior)
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

      const { data: profile, error: profileErr } = await rpcCall.single();

      console.info('[SIGNUP] Profile RPC error after single():', profileErr);

      if (profileErr || !profile) {
        console.error('[SIGNUP] Profile RPC error:', profileErr);

        // Rollback: delete created auth user to avoid orphaned accounts
        try {
          const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(newUser.id);
          if (deleteErr) console.error('[SIGNUP] Failed to delete auth user during rollback:', deleteErr);
          else console.info('[SIGNUP] Rolled back auth user after profile RPC failure:', newUser.id);
        } catch (delErr) {
          console.error('[SIGNUP] Rollback delete threw error:', delErr);
        }

        return NextResponse.json({ error: profileErr?.message || 'Failed to create user profile' }, { status: 500 });
      }

      // 3) Create server session so user can access dashboard immediately
      let session: any = null;
      try {
        session = await sessionManager.create(newUser.id, 24 * 7);
        console.info('[SIGNUP] Session created for user:', newUser.id);
      } catch (sessionErr) {
        console.error('[SIGNUP] Failed to create session:', sessionErr);
      }

      const response = NextResponse.json({
        success: true,
        user: profile,
        message: 'Account created successfully.',
      });

      if (session?.id) {
        response.cookies.set('session_id', session.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });
      }

      return response;
    } catch (rpcException) {
      console.error('[SIGNUP] RPC threw error:', rpcException)
      // Rollback auth user
      try {
        const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(newUser.id)
        if (deleteErr) console.error('[SIGNUP] Failed to delete auth user during rollback:', deleteErr)
        else console.info('[SIGNUP] Rolled back auth user after RPC exception:', newUser.id)
      } catch (delErr) {
        console.error('[SIGNUP] Rollback delete threw error:', delErr)
      }

      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }
  } catch (err) {
    console.error('[SIGNUP] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected signup error' }, { status: 500 })
  }
}