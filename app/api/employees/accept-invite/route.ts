import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/employees/accept-invite
 * Accepts an employee invite token and links auth_uid to internal user row
 * 
 * v1 AUTH FLOW:
 * STEP 1 — Validate token input
 * STEP 2 — Lookup invite (ADMIN CLIENT)
 * STEP 3 — Check if user already exists by email
 *   - If exists: Update only auth_uid (if missing) and workspace_id (if provided)
 *     Preserve existing role (do NOT overwrite)
 *   - If not exists: 
 *     a) CREATE Supabase auth user (returns auth_uid)
 *     b) CREATE internal user row with auth_uid linked
 * STEP 4 — Mark Invite Accepted (LAST STEP)
 * STEP 5 — Return success with redirect to login
 * 
 * CRITICAL: auth_uid linkage is the key requirement for login to work.
 * The login endpoint uses auth_uid to find the internal user row.
 * Without proper auth_uid linkage, login will fail with "User not found (403)".
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

    // v1: workspace_id is optional (null for platform-level invites)
    // super_admins and platform employees may not have a workspace assigned at invite time

    // ===== CRITICAL: ROLE CONFLICT CHECK =====
    // Employees cannot use emails already registered as super_admin or client_admin
    console.log('[INVITE ACCEPT] Checking for role conflicts with reserved admin roles:', invite.email);
    
    const { data: reservedRoleCheck, error: reservedCheckError } = await admin
      .from('users')
      .select('id, email, role')
      .eq('email', invite.email)
      .in('role', ['super_admin', 'client_admin']);

    if (reservedRoleCheck && reservedRoleCheck.length > 0) {
      const reservedUser = reservedRoleCheck[0];
      console.warn('[INVITE ACCEPT] Email is reserved for admin role - cannot accept as employee', {
        email: invite.email,
        reserved_role: reservedUser.role,
        user_id: reservedUser.id,
      });
      return NextResponse.json(
        { success: false, error: 'This email is reserved for client admins' },
        { status: 409 }
      );
    }

    if (reservedCheckError) {
      console.error('[INVITE ACCEPT] Error checking role conflicts:', reservedCheckError);
      return NextResponse.json(
        { success: false, error: 'Failed to validate email role' },
        { status: 500 }
      );
    }

    console.log('[INVITE ACCEPT] Role conflict check passed - email is available for employee');

    // ============================================================
    // STEP 3: CHECK IF USER ALREADY EXISTS BY EMAIL
    // ============================================================
    console.log('[INVITE ACCEPT] Checking if user already exists by email');

    const { data: existingUsers, error: existingError } = await admin
      .from('users')
      .select('id, auth_uid, role, workspace_id')
      .eq('email', invite.email);

    let userId: string;
    let authUid: string | null;

    if (existingUsers && existingUsers.length > 0) {
      // Handle multiple users with same email (shouldn't happen but be safe)
      if (existingUsers.length > 1) {
        console.warn('[INVITE ACCEPT] Multiple users found with same email, using first one', {
          email: invite.email,
          count: existingUsers.length,
          user_ids: existingUsers.map(u => u.id),
        });
      }

      const existingUser = existingUsers[0];
      
      // CRITICAL: Reject if user is super_admin or client_admin - they cannot be employees
      if (existingUser.role === 'super_admin' || existingUser.role === 'client_admin') {
        console.log('[INVITE ACCEPT] User is admin - cannot accept employee invite', {
          email: invite.email,
          existing_role: existingUser.role,
        });
        return NextResponse.json(
          { success: false, error: 'Admins cannot become employees. Use a different email.' },
          { status: 400 }
        );
      }

      userId = existingUser.id;
      authUid = existingUser.auth_uid;

      console.log('[INVITE ACCEPT] User already exists (found by email):', {
        user_id: userId,
        existing_auth_uid: authUid,
        existing_role: existingUser.role,
        existing_workspace_id: existingUser.workspace_id,
      });

      // If user already has an auth_uid, use it; otherwise create new auth user
      if (!authUid) {
        console.log('[INVITE ACCEPT] Existing user has no auth_uid, creating new Supabase auth user');

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

        authUid = authData.user.id;
        console.log('[INVITE ACCEPT] New auth user created for existing internal user:', {
          user_id: userId,
          auth_uid: authUid,
        });

        // Update existing user with auth_uid (only if missing)
        const { error: updateError } = await admin
          .from('users')
          .update({ auth_uid: authUid })
          .eq('id', userId);

        if (updateError) {
          console.error('[INVITE ACCEPT] Failed to link auth_uid:', updateError?.message);
          return NextResponse.json(
            { success: false, error: 'Failed to link user account' },
            { status: 500 }
          );
        }
      } else {
        console.log('[INVITE ACCEPT] User already has auth_uid, no new auth user needed');
      }
    } else {
      // ============================================================
      // STEP 3A: NEW USER - CREATE SUPABASE AUTH USER
      // ============================================================
      console.log('[INVITE ACCEPT] No existing user found, creating new Supabase auth user');

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

      authUid = authData.user.id;
      console.log('[INVITE ACCEPT] Supabase auth user created', {
        email: invite.email,
        auth_uid: authUid,
      });

      // ============================================================
      // STEP 3B: NEW USER - CREATE MINIMAL INTERNAL USER ROW
      // ============================================================
      // CRITICAL: Do NOT set users.role = 'employee'
      // Employees are stored ONLY in the employees table
      // This users row is for auth_uid linkage only
      console.log('[INVITE ACCEPT] Creating minimal internal user row (NO ROLE SET)');

      const { data: newUser, error: userError } = await admin
        .from('users')
        .insert({
          auth_uid: authUid,
          email: invite.email,
          // role is NOT set - employees have no role in users table
          // workspace_id is NOT set - employees have workspace in employees table
        })
        .select('id')
        .single();

      if (userError) {
        // Handle duplicate constraint error gracefully
        if (userError.code === '23505' || userError.message?.includes('duplicate key')) {
          console.log('[INVITE ACCEPT] Concurrent insert detected. Re-querying by email...');
          
          // User was created by another concurrent request
          const { data: concurrentUsers } = await admin
            .from('users')
            .select('id, auth_uid')
            .eq('email', invite.email);

          if (concurrentUsers && concurrentUsers.length > 0) {
            const concurrentUser = concurrentUsers[0];
            userId = concurrentUser.id;
            
            // If the concurrent user doesn't have auth_uid set, update it to link this auth user
            if (!concurrentUser.auth_uid) {
              console.log('[INVITE ACCEPT] Linking auth_uid to concurrent user:', {
                user_id: userId,
                auth_uid: authUid,
              });

              const { error: updateError } = await admin
                .from('users')
                .update({ auth_uid: authUid })
                .eq('id', userId);

              if (updateError) {
                console.error('[INVITE ACCEPT] Failed to link auth_uid:', updateError?.message);
                return NextResponse.json(
                  { success: false, error: 'Failed to link user account' },
                  { status: 500 }
                );
              }

              console.log('[INVITE ACCEPT] Successfully linked auth_uid to internal user:', {
                user_id: userId,
                auth_uid: authUid,
              });
            } else {
              console.log('[INVITE ACCEPT] Concurrent user already has auth_uid:', {
                user_id: userId,
                existing_auth_uid: concurrentUser.auth_uid,
              });
            }
          } else {
            console.error('[INVITE ACCEPT] Duplicate error but user not found by email');
            return NextResponse.json(
              { success: false, error: 'Failed to create user profile' },
              { status: 500 }
            );
          }
        } else {
          console.error('[INVITE ACCEPT] User row creation failed:', userError?.message);
          return NextResponse.json(
            { success: false, error: 'Failed to create user profile' },
            { status: 500 }
          );
        }
      } else if (!newUser) {
        console.error('[INVITE ACCEPT] User row creation returned no data');
        return NextResponse.json(
          { success: false, error: 'Failed to create user profile' },
          { status: 500 }
        );
      } else {
        userId = newUser.id;
        console.log('[INVITE ACCEPT] Successfully created new user (NO ROLE):', {
          user_id: userId,
          auth_uid: authUid,
          email: invite.email,
        });
      }
    }

    // ============================================================
    // STEP 3C: CREATE EMPLOYEE RECORD (ONLY AUTHORITATIVE SOURCE)
    // ============================================================
    // CRITICAL: Employees are stored ONLY in the employees table
    // The employees table is authoritative for role resolution during login
    // This is where we track: auth_uid, workspace_id, invited_by_role
    console.log('[INVITE ACCEPT] Creating employee record (authoritative role source)');

    // Determine invited_by_role from the invite
    // If workspace_id is NULL → platform employee (super_admin invited)
    // If workspace_id is SET → client employee (client_admin invited)
    const invitedByRole = invite.workspace_id === null ? 'super_admin' : 'client_admin';

    // ✨ FIX #2: WORKSPACE RESOLUTION (AUTHORITATIVE)
    // - Super admin invites → workspace_id = PLATFORM_WORKSPACE_ID
    // - Client admin invites → workspace_id = their workspace_id
    // Employees MUST have a valid workspace_id (NOT NULL)
    const resolvedWorkspaceId = 
      invitedByRole === 'super_admin' 
        ? PLATFORM_WORKSPACE_ID 
        : invite.workspace_id;

    console.log('[INVITE ACCEPT] Workspace resolved for employee:', {
      invited_by_role: invitedByRole,
      resolved_workspace_id: resolvedWorkspaceId,
    });

    // Create or update employee record with workspace
    const { error: employeeError } = await admin
      .from('employees')
      .insert({
        auth_uid: authUid,
        email: invite.email,
        workspace_id: resolvedWorkspaceId,
        invited_by_role: invitedByRole,
        status: 'active',
      });

    // Enforce strict auth_uid constraint (no fallbacks)
    if (employeeError && (employeeError.code === '23505' || employeeError.message?.includes('duplicate'))) {
      console.log('[INVITE ACCEPT] Employee record already exists, skipping insert:', {
        email: invite.email,
        workspace_id: resolvedWorkspaceId,
        auth_uid: authUid,
      });
    } else if (employeeError) {
      console.error('[INVITE ACCEPT] Failed to create employee record:', employeeError?.message);
      return NextResponse.json(
        { success: false, error: 'Failed to create employee record' },
        { status: 500 }
      );
    } else {
      console.log('[INVITE ACCEPT] Employee record created:', {
        auth_uid: authUid,
        email: invite.email,
        workspace_id: resolvedWorkspaceId,
        invited_by_role: invitedByRole,
        status: 'active',
      });
    }

    // ============================================================
    // STEP 4: MARK INVITE ACCEPTED (LAST STEP)
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
    // STEP 5: RETURN SUCCESS (NO REDIRECTS, NO SESSION CHANGES)
    // ============================================================
    // CRITICAL: Invite acceptance ONLY creates an employee record.
    // It does NOT:
    // - Authenticate the user
    // - Change existing sessions
    // - Redirect to any dashboard
    // - Switch roles
    //
    // The frontend decides UX based on whether user is authenticated:
    // - If authenticated (admin): Show success + logout button
    // - If not authenticated: Redirect to /login?role=employee
    return NextResponse.json(
      {
        success: true,
        employee_id: userId,
        auth_uid: authUid,
        email: invite.email,
        workspace_id: resolvedWorkspaceId,
        invited_by_role: invitedByRole,
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
