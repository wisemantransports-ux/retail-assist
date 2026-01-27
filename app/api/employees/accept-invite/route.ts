import { createAdminSupabaseClient } from '@/lib/supabase/server';
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
      } else {
        console.log('[INVITE ACCEPT] User already has auth_uid, no new auth user needed');
      }

      // Update existing user: preserve role and workspace, only update if not already set
      const updatePayload: any = {};
      
      // Only set workspace_id if the invite provides one (not null)
      if (invite.workspace_id) {
        updatePayload.workspace_id = invite.workspace_id;
      }
      
      // Only set auth_uid if we just created it or if it was missing
      if (authUid && !existingUser.auth_uid) {
        updatePayload.auth_uid = authUid;
      }

      // If user has no role, set it from the invite
      if (!existingUser.role && invite.role) {
        updatePayload.role = invite.role;
        console.log('[INVITE ACCEPT] Existing user has no role, setting from invite:', {
          user_id: userId,
          role: invite.role,
        });
      } else if (!existingUser.role && !invite.role) {
        // Default to 'employee' if neither invite nor user has a role
        updatePayload.role = 'employee';
        console.log('[INVITE ACCEPT] Existing user has no role and invite has no role, defaulting to employee:', {
          user_id: userId,
        });
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await admin
          .from('users')
          .update(updatePayload)
          .eq('id', userId);

        if (updateError) {
          console.error('[INVITE ACCEPT] Failed to update existing user:', updateError?.message);
          return NextResponse.json(
            { success: false, error: 'Failed to update user profile' },
            { status: 500 }
          );
        }

        console.log('[INVITE ACCEPT] Existing user updated:', {
          user_id: userId,
          auth_uid: authUid,
          updates: updatePayload,
        });
      } else {
        console.log('[INVITE ACCEPT] No updates needed for existing user:', {
          user_id: userId,
          auth_uid: authUid,
        });
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
      // STEP 3B: NEW USER - CREATE INTERNAL USER ROW AND LINK auth_uid
      // ============================================================
      console.log('[INVITE ACCEPT] Creating internal user row linked to auth_uid');

      // Get role from invite, default to 'employee' if not specified
      const userRole = invite.role || 'employee';

      const { data: newUser, error: userError } = await admin
        .from('users')
        .insert({
          auth_uid: authUid,
          email: invite.email,
          role: userRole,
          workspace_id: invite.workspace_id,
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
            .select('id, auth_uid, role, workspace_id')
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

            // Update workspace if needed
            if (invite.workspace_id && (!concurrentUser.workspace_id || concurrentUser.workspace_id !== invite.workspace_id)) {
              const { error: workspaceError } = await admin
                .from('users')
                .update({ workspace_id: invite.workspace_id })
                .eq('id', userId);

              if (workspaceError) {
                console.warn('[INVITE ACCEPT] Failed to update workspace_id:', workspaceError?.message);
              } else {
                console.log('[INVITE ACCEPT] Updated workspace_id for concurrent user:', {
                  user_id: userId,
                  workspace_id: invite.workspace_id,
                });
              }
            }

            // Update role if concurrent user has no role
            if (!concurrentUser.role && invite.role) {
              const { error: roleError } = await admin
                .from('users')
                .update({ role: invite.role })
                .eq('id', userId);

              if (roleError) {
                console.warn('[INVITE ACCEPT] Failed to update role for concurrent user:', roleError?.message);
              } else {
                console.log('[INVITE ACCEPT] Updated role for concurrent user:', {
                  user_id: userId,
                  role: invite.role,
                });
              }
            } else if (!concurrentUser.role && !invite.role) {
              // Default to 'employee' if neither has a role
              const { error: roleError } = await admin
                .from('users')
                .update({ role: 'employee' })
                .eq('id', userId);

              if (roleError) {
                console.warn('[INVITE ACCEPT] Failed to set default role for concurrent user:', roleError?.message);
              } else {
                console.log('[INVITE ACCEPT] Set default role for concurrent user:', {
                  user_id: userId,
                  role: 'employee',
                });
              }
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
        console.log('[INVITE ACCEPT] Successfully created and linked new user:', {
          user_id: userId,
          auth_uid: authUid,
          email: invite.email,
          role: 'employee',
          workspace_id: invite.workspace_id,
        });
      }
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
    // STEP 5: SYNC TO MOCK DATABASE (if in mock mode)
    // ============================================================
    // When in mock mode, ensure the user is also in the mock database
    // so that subsequent login calls can find them
    if (process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true' || process.env.MOCK_MODE === 'true') {
      try {
        console.log('[INVITE ACCEPT] Mock mode detected, syncing user to mock database');
        
        const fs = await import('fs');
        const path = await import('path');
        const dbPath = path.join(process.cwd(), 'tmp', 'dev-seed', 'database.json');
        
        // Read current mock database
        let mockDb: any = { users: {} };
        if (fs.existsSync(dbPath)) {
          try {
            mockDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
          } catch (e) {
            console.warn('[INVITE ACCEPT] Failed to parse mock database, creating new one');
          }
        }
        
        // Ensure users object exists
        if (!mockDb.users) mockDb.users = {};
        
        // Add or update user in mock database
        mockDb.users[userId] = {
          id: userId,
          auth_uid: authUid,
          email: invite.email,
          role: 'employee',
          workspace_id: invite.workspace_id || null,
          plan_type: 'starter',
          payment_status: 'unpaid',
          subscription_status: 'pending',
          business_name: '',
          phone: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        // Write back to mock database
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(mockDb, null, 2));
        
        console.log('[INVITE ACCEPT] User synced to mock database:', {
          user_id: userId,
          auth_uid: authUid,
          email: invite.email,
        });
      } catch (syncErr: any) {
        // Log warning but don't fail the entire request
        console.warn('[INVITE ACCEPT] Failed to sync to mock database:', syncErr?.message);
      }
    }

    // ============================================================
    // STEP 6: RETURN SUCCESS WITH REDIRECT URL
    // ============================================================
    // v1: Do NOT auto-login. User must login via /auth/login
    return NextResponse.json(
      {
        success: true,
        next: '/auth/login?invite=accepted',
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
