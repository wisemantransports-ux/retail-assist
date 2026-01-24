import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/employees/accept-invite
 * Accepts an employee invite token
 * 
 * REQUIRED BACKEND FLOW (EXACT ORDER):
 * STEP 1 — Validate token input
 * STEP 2 — Lookup invite (ADMIN CLIENT)
 * STEP 3 — Create Supabase Auth User
 * STEP 4 — Create Internal User Row (ADMIN CLIENT)
 * STEP 5 — Mark Invite Accepted (LAST STEP)
 * STEP 6 — Return success
 */
export async function POST(request: NextRequest) {
  try {
    // ============================================================
    // STEP 1: VALIDATE TOKEN INPUT
    // ============================================================
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || typeof token !== 'string') {
      console.log('[INVITE ACCEPT] Token validation failed', {
        token_present: !!token,
        token_type: typeof token,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invite token' },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email, first_name, last_name, password } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!first_name || typeof first_name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'First name is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password is required (minimum 6 characters)' },
        { status: 400 }
      );
    }

    console.log('[INVITE ACCEPT] token received', {
      token_length: token.length,
      token_preview: token.substring(0, 16),
    });

    // ============================================================
    // STEP 2: LOOKUP INVITE (ADMIN CLIENT)
    // ============================================================
    const admin = createAdminSupabaseClient();

    console.log('[INVITE ACCEPT] invite lookup starting');

    // Query employee_invites with admin client (bypasses RLS)
    const { data: invite, error: inviteError } = await admin
      .from('employee_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    // Invite not found or not pending
    if (inviteError || !invite) {
      console.log('[INVITE ACCEPT] invite found: false');
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invite token' },
        { status: 400 }
      );
    }

    console.log('[INVITE ACCEPT] invite found: true', {
      status: invite.status,
      email: invite.email,
      workspace_id: invite.workspace_id,
    });

    // ============================================================
    // STEP 3: CREATE SUPABASE AUTH USER
    // ============================================================
    console.log('[INVITE ACCEPT] Creating Supabase auth user');

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true,
    });

    if (authError || !authData?.user?.id) {
      console.error('[INVITE ACCEPT] Auth creation failed:', authError?.message);
      return NextResponse.json(
        { success: false, error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    const authUid = authData.user.id;
    console.log('[INVITE ACCEPT] Auth user created', { auth_uid: authUid });

    // ============================================================
    // STEP 4: CREATE INTERNAL USER ROW (ADMIN CLIENT)
    // ============================================================
    console.log('[INVITE ACCEPT] Creating internal user row');

    const { data: newUser, error: userError } = await admin
      .from('users')
      .insert({
        auth_uid: authUid,
        email: invite.email,
        role: 'employee',
        workspace_id: invite.workspace_id,
      })
      .select('id')
      .single();

    if (userError || !newUser) {
      console.error('[INVITE ACCEPT] User row creation failed:', userError?.message);
      return NextResponse.json(
        { success: false, error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    const userId = newUser.id;
    console.log('[INVITE ACCEPT] User row created', { user_id: userId });

    // ============================================================
    // STEP 5: MARK INVITE ACCEPTED (LAST STEP)
    // ============================================================
    console.log('[INVITE ACCEPT] Marking invite as accepted');

    const { error: updateError } = await admin
      .from('employee_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('[INVITE ACCEPT] Update failed:', updateError?.message);
      return NextResponse.json(
        { success: false, error: 'Failed to mark invite as accepted' },
        { status: 500 }
      );
    }

    console.log('[INVITE ACCEPT] Invite marked as accepted');

    // ============================================================
    // STEP 6: RETURN SUCCESS
    // ============================================================
    return NextResponse.json(
      {
        success: true,
        user_id: userId,
        workspace_id: invite.workspace_id,
        role: 'employee',
        message: 'Invite accepted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[INVITE ACCEPT] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
