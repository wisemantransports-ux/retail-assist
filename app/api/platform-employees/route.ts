import { createServerClient } from '@supabase/ssr';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/platform-employees
 * POST /api/platform-employees
 * Platform-scoped employee management (super_admin only)
 */

/**
 * Helper: Ensure internal user ID exists for a super_admin auth_uid
 * Looks up auth_uid in users table and returns internal id
 */
async function ensureInternalUser(auth_uid: string): Promise<{ id: string } | null> {
  if (!auth_uid) {
    console.error('[ensureInternalUser] Missing auth_uid');
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data: internalUser, error: userLookupError } = await admin
    .from('users')
    .select('id')
    .eq('auth_uid', auth_uid)
    .maybeSingle();

  if (userLookupError) {
    console.error('[ensureInternalUser] Database error:', {
      auth_uid,
      error: userLookupError.message,
    });
    return null;
  }

  if (!internalUser) {
    console.error('[ensureInternalUser] User not found in users table:', { auth_uid });
    return null;
  }

  console.log('[ensureInternalUser] Found internal user:', {
    auth_uid,
    internal_id: internalUser.id,
  });

  return internalUser;
}
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    );

    // Auth & role check via trusted /api/auth/me endpoint
    const authMeRes = await fetch('http://localhost:3000/api/auth/me', {
      headers: { 'Cookie': request.headers.get('cookie') || '' }
    });
    if (!authMeRes.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: authMeRes.status });
    const authMe = await authMeRes.json();

    const resolvedRole = authMe.role;
    const authUser = authMe.user;
    const authUserWorkspace = authMe.workspaceId;

    // ===== CRITICAL: SUPER ADMIN SCOPE ENFORCEMENT =====
    if (resolvedRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Super admins only' },
        { status: 403 }
      );
    }

    // super_admin.workspace_id MUST be NULL
    if (authUserWorkspace !== null && authUserWorkspace !== undefined) {
      console.error('[PLATFORM EMPLOYEES GET] ✗ Invalid super_admin state: workspace_id is not NULL');
      return NextResponse.json(
        { error: 'Invalid admin account state' },
        { status: 403 }
      );
    }

    console.log('[platform-employees GET] ✓ Authorized super_admin with platform-wide scope:', authUser?.id);

    // Fetch platform employees with admin client to bypass RLS
    const admin = createAdminSupabaseClient();
    const { data: employees, error: queryError } = await admin
      .from('employees')
      .select(`
        id,
        user_id,
        workspace_id,
        is_active,
        created_at,
        updated_at,
        role,
        users!inner(email)
      `)
      .is('workspace_id', null)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[/api/platform-employees GET] Query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch platform staff' }, { status: 500 });
    }

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('[/api/platform-employees GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role } = body;

    // Reject any unexpected fields to prevent legacy data passing through
    const allowedKeys = ['email', 'role'];
    const providedKeys = Object.keys(body);
    const unexpectedKeys = providedKeys.filter(key => !allowedKeys.includes(key));
    if (unexpectedKeys.length > 0) {
      console.warn(`[/api/platform-employees POST] Rejected unexpected fields: ${unexpectedKeys.join(', ')}`);
      return NextResponse.json({ error: `Unexpected fields: ${unexpectedKeys.join(', ')}` }, { status: 400 });
    }

    // Validate email (mandatory)
    if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });

    // Validate role if provided (optional)
    if (role && typeof role !== 'string') return NextResponse.json({ error: 'Role must be a string' }, { status: 400 });

    // Auth & role check via trusted /api/auth/me endpoint
    const authMeRes = await fetch('http://localhost:3000/api/auth/me', {
      headers: { 'Cookie': request.headers.get('cookie') || '' }
    });
    if (!authMeRes.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: authMeRes.status });
    const authMe = await authMeRes.json();

    const resolvedRole = authMe.role;
    const authUser = authMe.user;
    const authUserWorkspace = authMe.workspaceId;

    // ===== CRITICAL: SUPER ADMIN SCOPE ENFORCEMENT =====
    // Only super_admin can access this endpoint
    if (resolvedRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Super admins only' },
        { status: 403 }
      );
    }

    // super_admin.workspace_id MUST be NULL (platform-wide scope)
    if (authUserWorkspace !== null && authUserWorkspace !== undefined) {
      console.error('[PLATFORM EMPLOYEES] ✗ Invalid super_admin state: workspace_id is not NULL', {
        user_id: authUser?.id,
        workspace_id: authUserWorkspace,
      });
      return NextResponse.json(
        { error: 'Invalid admin account state' },
        { status: 403 }
      );
    }

    console.log('[platform-employees] ✓ Authorized super_admin with platform-wide scope:', authUser?.id);

    // Resolve auth user to internal users.id using the helper function
    const internalUser = await ensureInternalUser(authUser.id);
    if (!internalUser?.id) {
      console.error('[/api/platform-employees POST] Cannot resolve internal user ID for auth_uid:', authUser.id);
      return NextResponse.json({ error: 'Cannot resolve internal user ID' }, { status: 401 });
    }

    const internal_user_id = internalUser.id;

    // ===== CRITICAL: EMAIL VALIDATION FOR EMPLOYEE INVITES =====
    // Employees cannot use emails already registered as:
    // - super_admin or admin (in users table)
    // - existing employee (in employees table)
    console.log('[INVITE CREATE] Checking if email is already in use:', email);
    
    const admin = createAdminSupabaseClient();
    
    // Check 1: Email must not exist as super_admin or admin
    const { data: existingUserCheck, error: checkError } = await admin
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .in('role', ['super_admin', 'admin']);

    if (existingUserCheck && existingUserCheck.length > 0) {
      const existingUser = existingUserCheck[0];
      console.warn('[INVITE CREATE] Email rejected - reserved for admin role', {
        email,
        existing_role: existingUser.role,
        user_id: existingUser.id,
      });
      return NextResponse.json(
        { error: 'Email already in use by another role' },
        { status: 409 }
      );
    }

    if (checkError) {
      console.error('[INVITE CREATE] Error checking email availability in users:', checkError);
      return NextResponse.json({ error: 'Failed to validate email' }, { status: 500 });
    }

    // Check 2: Email must not already have a pending or accepted invite
    const { data: existingInviteCheck, error: inviteCheckError } = await admin
      .from('employee_invites')
      .select('id, email, status')
      .eq('email', email)
      .in('status', ['pending', 'accepted']);

    if (existingInviteCheck && existingInviteCheck.length > 0) {
      console.warn('[INVITE CREATE] Email rejected - already has pending or accepted invite', {
        email,
        invite_count: existingInviteCheck.length,
      });
      return NextResponse.json(
        { error: 'Email already has an existing invite' },
        { status: 409 }
      );
    }

    if (inviteCheckError) {
      console.error('[INVITE CREATE] Error checking email in employee_invites table:', inviteCheckError);
      return NextResponse.json({ error: 'Failed to validate email' }, { status: 500 });
    }

    console.log('[INVITE CREATE] Email validation passed - not reserved for any role');

    // STEP 2: Create invite via RPC scoped to platform (workspace_id = null)
    // RPC will generate the token and insert the row
    const { data: invite, error: rpcError } = await admin.rpc('rpc_create_employee_invite', {
      p_email: email,
      p_role: role || 'employee',
      p_workspace_id: null,
      p_invited_by: internal_user_id,
    });

    if (rpcError) {
      console.error('[INVITE CREATE] RPC error:', rpcError);
      return NextResponse.json({ error: rpcError.message || 'Failed to create invite' }, { status: 400 });
    }

    console.log('[INVITE CREATE] RPC response:', {
      response_length: invite?.length,
      first_row: invite?.[0],
    });

    // RPC returns array of rows with structure: { id, workspace_id, invited_by, email, token, status, created_at, updated_at }
    const inviteRow = invite?.[0];
    if (!inviteRow || !inviteRow.id || !inviteRow.token) {
      console.error('[INVITE CREATE] RPC returned invalid data:', {
        invite_data: invite,
      });
      return NextResponse.json({ error: 'Failed to create invite - invalid response' }, { status: 500 });
    }

    const inviteId = inviteRow.id;
    const inviteToken = inviteRow.token;

    // Verify token was inserted
    const { data: verifyInvite, error: verifyError } = await admin
      .from('employee_invites')
      .select('id, token, status')
      .eq('id', inviteId)
      .single();

    if (verifyError || !verifyInvite) {
      console.error('[INVITE CREATE] Verification failed:', {
        invite_id: inviteId,
        verify_error: verifyError?.message,
      });
      return NextResponse.json({ error: 'Invite verification failed' }, { status: 500 });
    }

    console.log('[INVITE CREATE] Token verified in database:', {
      invite_id: inviteId,
      token_in_db: verifyInvite.token,
      token_generated: inviteToken,
      match: verifyInvite.token === inviteToken ? 'YES' : 'NO',
      status: verifyInvite.status,
    });

    console.log('[INVITE CREATE] Inserted token:', {
      invite_id: inviteId,
      token: inviteToken,
      email,
    });

    // STEP 4: Return response with token
    const responsePayload = {
      success: true,
      message: 'Invite created successfully',
      invite: {
        id: inviteId,
        token: inviteToken,
        email,
      },
    };

    console.log('[INVITE CREATE] Returned token:', {
      invite_id: inviteId,
      token: inviteToken,
      matches: inviteToken === responsePayload.invite.token ? 'YES' : 'NO',
    });

    return NextResponse.json(responsePayload, { status: 201 });

  } catch (error) {
    console.error('[/api/platform-employees POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}