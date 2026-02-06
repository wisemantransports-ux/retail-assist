import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { PLAN_LIMITS } from '@/lib/db/index';

/**
 * GET /api/employees
 * Returns list of employees for the current admin's workspace
 * 
 * SECURITY:
 * - Only admins can list employees in their workspace
 * - Results are scoped to the admin's workspace_id
 * - Employees cannot access this endpoint
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's role and workspace from RPC (authoritative source)
    const { data: roleData, error: roleError } = await supabase
      .rpc('rpc_get_user_access')
      .single();

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    }

    const { role, workspace_id } = roleData as { role: string; workspace_id: string };

    // Only admins can list employees
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    // Admin must have workspace_id
    if (!workspace_id) {
      return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
    }

    // Query employees scoped to the admin's workspace
    // WORKSPACE SCOPING: Filter by workspace_id to prevent cross-workspace access
    const { data: employees, error: queryError } = await supabase
      .from('employees')
      .select('id, user_id, workspace_id, is_active, created_at, updated_at')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[/api/employees GET] Query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }

    // Log access for audit trail
    console.log(`[/api/employees GET] Admin ${user.id} fetched employees for workspace ${workspace_id}`);

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('[/api/employees GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/employees/invite
 * Creates an employee invite token (admin only)
 * 
 * SECURITY:
 * - Only admins can create invites for their workspace
 * - Invites are scoped to the admin's workspace_id
 * - RPC validates authorization before creating invite
 * - Plan-aware restrictions enforced (Starter: max 2, Pro: max 5, Enterprise: unlimited)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Reject any unexpected fields to prevent legacy data passing through
    // Note: workspace_id is NOT accepted from client; it comes from authenticated user context
    const allowedKeys = ['email'];
    const providedKeys = Object.keys(body);
    const unexpectedKeys = providedKeys.filter(key => !allowedKeys.includes(key));
    if (unexpectedKeys.length > 0) {
      console.warn(`[/api/employees POST] Rejected unexpected fields: ${unexpectedKeys.join(', ')}`);
      return NextResponse.json({ error: `Unexpected fields: ${unexpectedKeys.join(', ')}` }, { status: 400 });
    }

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve auth user to internal users.id using auth_uid
    // This is required for FK constraint: employee_invites.invited_by -> users.id
    const { data: internalUser, error: userLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', user.id)
      .maybeSingle();

    if (userLookupError || !internalUser) {
      console.error('[/api/employees/invite POST] Failed to resolve internal user ID:', {
        auth_uid: user.id,
        error: userLookupError?.message,
      });
      return NextResponse.json({ error: 'Unable to resolve user profile' }, { status: 401 });
    }

    const internal_user_id = internalUser.id;

    // Get user's role and workspace from RPC
    const result = await supabase
      .rpc('rpc_get_user_access')
      .single();
    const roleData = result.data;

    if (!roleData) {
      return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    }

    const { role, workspace_id } = roleData as { role: string; workspace_id: string };

    // ===== CRITICAL: ADMIN SCOPE ENFORCEMENT =====
    // Only admins can create invites
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    // Admin MUST have workspace_id (client admins are scoped to exactly one workspace)
    if (!workspace_id) {
      console.error('[/api/employees/invite POST] Admin has no workspace_id:', {
        user_id: user.id,
        role,
        roleData,
      });
      return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
    }

    // ===== CRITICAL: NEVER ACCEPT workspace_id FROM FRONTEND =====
    // workspace_id is ALWAYS derived from authenticated user context
    // Client admin can ONLY invite employees to their own workspace
    // This prevents cross-workspace privilege escalation
    const inviteWorkspaceId = workspace_id;  // NOT from request body
    console.log('[INVITE CREATE] Invite workspace determined from authenticated user context:', {
      user_id: user.id,
      admin_workspace_id: inviteWorkspaceId,
    });

    // ===== CRITICAL: EMAIL VALIDATION FOR CLIENT EMPLOYEE INVITES =====
    // Emails must not exist as super_admin, client_admin, or in another workspace's employees
    console.log('[INVITE CREATE] Checking if email is already in use:', email);
    
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server');
    const admin = createAdminSupabaseClient();

    // Check 1: Email must not exist as super_admin or client_admin
    const { data: existingUserCheck, error: userCheckError } = await admin
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .in('role', ['super_admin', 'client_admin']);

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

    if (userCheckError) {
      console.error('[INVITE CREATE] Error checking email in users table:', userCheckError);
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

    // ============================================================================
    // PLAN-AWARE RESTRICTION: Check employee limit before creating invite
    // ============================================================================
    
    // Fetch workspace/user plan information to enforce limits
    let planType: 'starter' | 'pro' | 'enterprise' = 'starter';
    let maxEmployees = PLAN_LIMITS['starter'].maxEmployees;
    
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('plan_type')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspaceData) {
      console.warn('[/api/employees/invite POST] Workspace lookup failed, using default plan:', {
        workspace_id,
        error: workspaceError?.message,
        user_id: user.id,
      });
      // Fallback to starter plan if workspace lookup fails
      // This can happen due to RLS policies or network issues
      // The RPC will still validate authorization
    } else {
      planType = (workspaceData.plan_type || 'starter') as 'starter' | 'pro' | 'enterprise';
      maxEmployees = PLAN_LIMITS[planType].maxEmployees;
    }

    // Count current active employees in workspace (only counting non-invites, actual employees)
    const { data: employees, error: countError } = await supabase
      .from('employees')
      .select('id', { count: 'exact' })
      .eq('workspace_id', workspace_id);

    if (countError) {
      console.error('[/api/employees/invite POST] Employee count error:', {
        workspace_id,
        error: countError?.message,
        details: countError,
      });
      return NextResponse.json({ 
        error: 'Failed to check employee limit',
      }, { status: 500 });
    }

    const currentEmployeeCount = employees?.length || 0;

    // Check if adding a new employee would exceed limit
    if (maxEmployees !== -1 && currentEmployeeCount >= maxEmployees) {
      // Log violation for audit trail
      await supabase.from('logs').insert({
        user_id: user.id,
        level: 'warn',
        message: `Employee limit violation: Attempted to invite employee when at limit`,
        meta: {
          reason: 'plan_limit_exceeded',
          plan_type: planType,
          max_employees: maxEmployees,
          current_employees: currentEmployeeCount,
          attempted_addition: 1,
          workspace_id: workspace_id,
          invitee_email: email,
        },
      });

      console.warn(`[/api/employees/invite POST] Plan limit violation: User ${user.id} workspace ${workspace_id} at limit (${planType}: ${maxEmployees} max, ${currentEmployeeCount} current)`);
      
      return NextResponse.json(
        { 
          error: `Your ${PLAN_LIMITS[planType].name} plan allows only ${maxEmployees} employee(s). You currently have ${currentEmployeeCount}. Upgrade to add more.`,
          plan: planType,
          limit: maxEmployees,
          current: currentEmployeeCount,
        },
        { status: 403 }
      );
    }

    // Call RPC to create invite
    // PARAMETERS (for client admins):
    // - p_email: email address to invite
    // - p_invited_by: current admin's internal user ID from public.users (REQUIRED)
    // - p_role: employee role (optional, will use default if not provided)
    // - p_workspace_id: workspace UUID (inferred from admin context, passed for clarity)
    //
    // AUTHORIZATION: RPC validates admin is inviting to their own workspace
    console.log('[/api/employees/invite POST] Calling RPC to create invite:', {
      p_email: email,
      p_role: 'employee',
      p_workspace_id: workspace_id,
      p_invited_by: internal_user_id,
    });

    const { data: invite, error: rpcError } = await supabase.rpc(
      'rpc_create_employee_invite',
      {
        p_email: email,
        p_role: 'employee',
        p_workspace_id: workspace_id,
        p_invited_by: internal_user_id,
      }
    );

    console.log('[/api/employees/invite POST] RPC response:', {
      error: rpcError?.message,
      data_length: Array.isArray(invite) ? invite.length : 'not_array',
      first_row: invite?.[0],
    });

    if (rpcError) {
      console.error('[/api/employees/invite POST] RPC error:', rpcError);
      // RPC errors usually mean authorization failed
      return NextResponse.json({ error: rpcError.message || 'Failed to create invite' }, { status: 400 });
    }

    if (!invite || !Array.isArray(invite) || invite.length === 0) {
      console.error('[/api/employees/invite POST] RPC returned empty result:', invite);
      return NextResponse.json({ error: 'Failed to create invite - no result returned' }, { status: 400 });
    }

    // Log successful action for audit trail
    console.log(`[/api/employees/invite POST] Admin ${user.id} created invite for ${email} in workspace ${workspace_id} (${planType}: ${currentEmployeeCount}/${maxEmployees})`);
    console.log('[/api/employees/invite POST] Invite created with token:', {
      invite_id: invite[0]?.invite_id,
      token: invite[0]?.token?.substring(0, 16) + '...',
      token_length: invite[0]?.token?.length,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Invite created successfully',
        invite: {
          id: invite[0]?.invite_id,
          token: invite[0]?.token,
          email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[/api/employees/invite POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
