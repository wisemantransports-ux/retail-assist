import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/employees/accept-invite
 * Accepts an employee invite token
 * 
 * REQUEST:
 * {
 *   token: string (required) - invite token from URL
 *   email: string (required) - user's email (must match invite email)
 *   first_name: string (required) - user's first name
 *   last_name: string (optional) - user's last name
 *   password: string (required) - password for new auth account
 * }
 * 
 * RESPONSE (Success):
 * {
 *   success: true,
 *   workspace_id: uuid,
 *   role: "employee",
 *   user_id: uuid,
 *   message: "Invite accepted successfully"
 * }
 * 
 * RESPONSE (Error):
 * {
 *   success: false,
 *   error: "descriptive error message"
 * }
 * 
 * SECURITY:
 * - No authentication required (new employees haven't been created yet)
 * - Email must match the invite email exactly
 * - Token must be valid and pending
 * - Creates auth account with provided password
 * - Inviter must be workspace admin (verified)
 * - Logs all actions for audit trail
 */
export async function POST(request: NextRequest) {
  try {
    // Extract token from URL query string (NOT from request body)
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    console.log('[INVITE ACCEPT] token:', token);
    console.log('[INVITE ACCEPT] Full URL:', request.url);
    console.log('[INVITE ACCEPT] Token details:', {
      token_value: token,
      token_length: token?.length,
      token_preview: token?.substring(0, 32),
      is_string: typeof token === 'string',
      has_percent_encoding: token?.includes('%'),
      has_spaces: token?.includes(' '),
      has_plus: token?.includes('+'),
    });

    // Validate token is present
    if (!token || typeof token !== 'string') {
      console.error('[INVITE ACCEPT] Token validation failed:', {
        token_falsy: !token,
        token_type: typeof token,
      });
      return NextResponse.json(
        { success: false, error: 'Missing invite token' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[/api/employees/accept-invite POST] Request body parse error:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email, first_name, last_name, password } = body;

    console.log('[/api/employees/accept-invite POST] Accepting invite:', { 
      token: token.substring(0, 8) + '...', 
      token_length: token.length,
      email, 
      first_name 
    });

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

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // For employee invite acceptance, we need SERVICE_ROLE_KEY because:
    // 1. Unauthenticated users are accepting invites (not yet in auth.users)
    // 2. RLS policies block anon key from reading employee_invites
    // 3. Service role bypasses RLS for this specific operation
    const supabaseService = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Step 1: Look up the invite to get workspace_id and verify email
    console.log('[/api/employees/accept-invite POST] Looking up invite with token:', {
      token_received: token,
      token_length: token.length,
      token_preview: token.substring(0, 16),
      token_type: typeof token,
    });

    // SOLUTION 1: Look up by token only first (to see if token exists at all)
    console.log('[/api/employees/accept-invite POST] Step 1: Token lookup starting...');
    
    // Use service role key to bypass RLS for unauthenticated users
    // Note: expires_at column doesn't exist yet in production DB, so we query without it
    // Expiration will be checked based on created_at timestamp (30 days)
    const { data: tokenCheckData, error: tokenCheckError } = await supabaseService
      .from('employee_invites')
      .select('id, workspace_id, email, invited_by, status, created_at, token')
      .eq('token', token)
      .maybeSingle();

    console.log('[/api/employees/accept-invite POST] Step 1: Token lookup result:', {
      found: !!tokenCheckData,
      token_sent_length: token.length,
      token_db_length: tokenCheckData?.token?.length,
      status: tokenCheckData?.status,
      error: tokenCheckError?.message,
      error_code: tokenCheckError?.code,
      error_details: tokenCheckError?.details,
    });

    if (tokenCheckError) {
      console.error('[/api/employees/accept-invite POST] ❌ Token lookup database error:', {
        message: tokenCheckError.message,
        code: tokenCheckError.code,
        details: tokenCheckError.details,
        full_error: tokenCheckError,
      });
      
      // Check if the issue is missing service role key
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[/api/employees/accept-invite POST] CRITICAL: SUPABASE_SERVICE_ROLE_KEY not set in environment');
        return NextResponse.json(
          { success: false, error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Database error during token lookup' },
        { status: 500 }
      );
    }

    // Token not found
    if (!tokenCheckData) {
      console.error('[/api/employees/accept-invite POST] Token not found in database:', {
        token_sent: token.substring(0, 8) + '...',
        token_length: token.length,
      });
      
      // Debug: Check if ANY invites exist
      const { data: sampleInvites } = await supabase
        .from('employee_invites')
        .select('token, status')
        .limit(1);
      
      console.warn('[/api/employees/accept-invite POST] Sample invite for comparison:', 
        sampleInvites?.[0] ? {
          sample_token_length: sampleInvites[0].token?.length,
          sample_status: sampleInvites[0].status,
          sent_token_length: token.length,
        } : 'no invites found'
      );
      
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invite token' },
        { status: 400 }
      );
    }

    console.log('[/api/employees/accept-invite POST] Step 1: ✅ Token found in database');


    const inviteData = tokenCheckData;

    // Check status AFTER finding the token (helps with debugging)
    console.log('[/api/employees/accept-invite POST] Step 2: Status check...');
    if (inviteData.status !== 'pending') {
      console.error('[/api/employees/accept-invite POST] Step 2: ❌ Invite not pending:', {
        current_status: inviteData.status,
        token: token.substring(0, 8) + '...',
      });
      return NextResponse.json(
        { success: false, error: `This invite has already been ${inviteData.status}` },
        { status: 400 }
      );
    }
    console.log('[/api/employees/accept-invite POST] Step 2: ✅ Status is pending');

    console.log('[/api/employees/accept-invite POST] Step 3: Expiration check...');
    // Expiration check: invites expire 30 days after creation
    // Using created_at since expires_at column doesn't exist in production DB yet
    const createdAt = new Date(inviteData.created_at);
    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(createdAt.getTime() + thirtyDaysMs);
    
    console.log('[/api/employees/accept-invite POST] Expiration details:', {
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      now: now.toISOString(),
      is_expired: expiresAt < now,
      time_remaining_ms: expiresAt.getTime() - now.getTime(),
    });
    
    if (expiresAt < now) {
      console.error('[/api/employees/accept-invite POST] Step 3: ❌ Invite expired');
      return NextResponse.json(
        { success: false, error: 'This invite has expired' },
        { status: 400 }
      );
    }
    console.log('[/api/employees/accept-invite POST] Step 3: ✅ Not expired');

    // Step 3: Verify email matches
    console.log('[/api/employees/accept-invite POST] Step 4: Email matching check...');
    console.log('[/api/employees/accept-invite POST] Email comparison:', {
      db_email: inviteData.email,
      request_email: email,
      db_email_lowercase: inviteData.email.toLowerCase(),
      request_email_lowercase: email.toLowerCase(),
      match_case_insensitive: inviteData.email.toLowerCase() === email.toLowerCase(),
    });

    if (inviteData.email.toLowerCase() !== email.toLowerCase()) {
      console.error('[/api/employees/accept-invite POST] Step 4: ❌ Email mismatch');
      return NextResponse.json(
        { success: false, error: 'Email does not match the invitation' },
        { status: 400 }
      );
    }
    console.log('[/api/employees/accept-invite POST] Step 4: ✅ Email matches');

    // Step 4: Verify inviter is a client-admin (not super-admin)
    // Check both users table role and admin_access for workspace membership
    const { data: inviterData, error: inviterError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', inviteData.invited_by)
      .single();

    if (inviterError || !inviterData) {
      console.error('[/api/employees/accept-invite POST] Inviter lookup error:', inviterError);
      return NextResponse.json(
        { success: false, error: 'Inviter not found' },
        { status: 400 }
      );
    }

    // Ensure inviter is NOT super_admin (client-admin only)
    if (inviterData.role === 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Super-admin invites are not supported in this flow' },
        { status: 400 }
      );
    }

    // Step 5: Verify inviter has 'client_admin' role (either via users.role or admin_access role)
    // First check admin_access table
    const { data: adminAccessData, error: adminAccessError } = await supabase
      .from('admin_access')
      .select('id, role')
      .eq('user_id', inviteData.invited_by)
      .eq('workspace_id', inviteData.workspace_id)
      .maybeSingle();

    if (adminAccessError) {
      console.error('[/api/employees/accept-invite POST] Admin access lookup error:', adminAccessError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify inviter access' },
        { status: 500 }
      );
    }

    // Inviter must have admin_access record for this workspace
    if (!adminAccessData) {
      console.error('[/api/employees/accept-invite POST] Inviter has no admin access to workspace', {
        inviter_id: inviteData.invited_by,
        workspace_id: inviteData.workspace_id
      });
      return NextResponse.json(
        { success: false, error: 'Inviter must be a client admin to invite employees' },
        { status: 403 }
      );
    }

    // Verify inviter has admin role (not just a member)
    if (adminAccessData.role !== 'admin' && adminAccessData.role !== 'super_admin') {
      console.error('[/api/employees/accept-invite POST] Inviter does not have admin role', {
        inviter_id: inviteData.invited_by,
        inviter_role: adminAccessData.role
      });
      return NextResponse.json(
        { success: false, error: 'Inviter must have admin role to invite employees' },
        { status: 403 }
      );
    }

    // Step 6: Create or get user profile for the invitee
    // First check if user already exists
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, auth_uid')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    let userId: string;
    let authUid: string | null = null;

    if (existingUser && existingUser.auth_uid) {
      // User exists with auth account, just reuse
      userId = existingUser.id;
      authUid = existingUser.auth_uid;
      console.log('[/api/employees/accept-invite POST] Using existing user with auth:', { userId, email });
    } else {
      // Create new auth account via Supabase Admin API
      const adminAuthClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            },
          },
        }
      );

      // Create auth user using admin API
      const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true, // Auto-confirm email since they're accepting via link
      });

      if (authError || !authData?.user?.id) {
        console.error('[/api/employees/accept-invite POST] Auth creation error:', authError);
        return NextResponse.json(
          { success: false, error: `Failed to create account: ${authError?.message || 'Unknown error'}` },
          { status: 500 }
        );
      }

      authUid = authData.user.id;

      // Create or update user profile with auth_uid
      if (existingUser) {
        // Update existing user profile with auth_uid
        const { error: updateError } = await supabase
          .from('users')
          .update({
            auth_uid: authUid,
            full_name: `${first_name} ${last_name || ''}`.trim(),
          })
          .eq('id', existingUser.id);

        if (updateError) {
          console.error('[/api/employees/accept-invite POST] User update error:', updateError);
          return NextResponse.json(
            { success: false, error: 'Failed to update user profile' },
            { status: 500 }
          );
        }

        userId = existingUser.id;
      } else {
        // Create new user profile
        const { data: newUser, error: newUserError } = await supabase
          .from('users')
          .insert({
            email: email.toLowerCase(),
            auth_uid: authUid,
            full_name: `${first_name} ${last_name || ''}`.trim(),
          })
          .select('id')
          .single();

        if (newUserError || !newUser) {
          console.error('[/api/employees/accept-invite POST] User creation error:', newUserError);
          return NextResponse.json(
            { success: false, error: 'Failed to create user profile' },
            { status: 500 }
          );
        }

        userId = newUser.id;
      }

      console.log('[/api/employees/accept-invite POST] Created auth account and user profile:', { 
        userId, 
        authUid,
        email 
      });
    }

    // Step 7: Create employee record in the workspace
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .insert({
        user_id: userId,
        workspace_id: inviteData.workspace_id,
        role: 'employee',
        full_name: `${first_name} ${last_name || ''}`.trim(),
      })
      .select('id, role')
      .single();

    if (employeeError) {
      console.error('[/api/employees/accept-invite POST] Employee creation error:', employeeError);
      // Check if error is due to duplicate (already an employee)
      if (employeeError.message?.includes('duplicate')) {
        return NextResponse.json(
          { success: false, error: 'User is already an employee in this workspace' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create employee record' },
        { status: 500 }
      );
    }

    // Step 8: Update invite status to accepted with full_name
    const fullName = `${first_name} ${last_name || ''}`.trim();
    const { error: updateError } = await supabase
      .from('employee_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        full_name: fullName,
      })
      .eq('id', inviteData.id);

    if (updateError) {
      console.warn('[/api/employees/accept-invite POST] Failed to update invite status:', updateError);
      // Don't fail the whole request, employee was created successfully
    }

    // Log action for audit trail
    console.log(`[/api/employees/accept-invite POST] User ${userId} accepted invite to workspace ${inviteData.workspace_id}`);

    const successResponse = {
      success: true,
      workspace_id: inviteData.workspace_id,
      user_id: userId,
      role: 'employee',
      message: 'Invite accepted successfully',
    };
    
    console.log('[/api/employees/accept-invite POST] Sending success response:', successResponse);
    const response = NextResponse.json(successResponse, { status: 200 });
    console.log('[/api/employees/accept-invite POST] Response created, returning...');
    return response;
  } catch (error) {
    console.error('[/api/employees/accept-invite POST] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
