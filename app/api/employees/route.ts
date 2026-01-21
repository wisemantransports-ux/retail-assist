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

    // Get user's role and workspace from RPC
    const { data: roleData, error: roleError } = await supabase
      .rpc('rpc_get_user_access')
      .single();

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    }

    const { role, workspace_id } = roleData as { role: string; workspace_id: string };

    // Only admins can create invites
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    // Admin must have workspace_id
    if (!workspace_id) {
      return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
    }

    // ============================================================================
    // PLAN-AWARE RESTRICTION: Check employee limit before creating invite
    // ============================================================================
    
    // Fetch workspace/user plan information to enforce limits
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('plan_type')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspaceData) {
      console.error('[/api/employees/invite POST] Workspace lookup error:', workspaceError);
      return NextResponse.json({ error: 'Failed to fetch workspace information' }, { status: 500 });
    }

    const planType = (workspaceData.plan_type || 'starter') as 'starter' | 'pro' | 'enterprise';
    const planLimits = PLAN_LIMITS[planType];
    const maxEmployees = planLimits.maxEmployees;

    // Count current active employees in workspace (only counting non-invites, actual employees)
    const { data: employees, error: countError } = await supabase
      .from('employees')
      .select('id', { count: 'exact' })
      .eq('workspace_id', workspace_id);

    if (countError) {
      console.error('[/api/employees/invite POST] Employee count error:', countError);
      return NextResponse.json({ error: 'Failed to check employee limit' }, { status: 500 });
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
          error: `Your ${planLimits.name} plan allows only ${maxEmployees} employee(s). You currently have ${currentEmployeeCount}. Upgrade to add more.`,
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
    // - p_invited_by: current admin user ID (REQUIRED)
    // - p_role: employee role (optional, will use default if not provided)
    // - p_workspace_id: workspace UUID (inferred from admin context, passed for clarity)
    //
    // AUTHORIZATION: RPC validates admin is inviting to their own workspace
    const { data: invite, error: rpcError } = await supabase.rpc(
      'rpc_create_employee_invite',
      {
        p_email: email,
        p_role: 'employee',
        p_workspace_id: workspace_id,
        p_invited_by: user.id,
      }
    );

    if (rpcError) {
      console.error('[/api/employees/invite POST] RPC error:', rpcError);
      // RPC errors usually mean authorization failed
      return NextResponse.json({ error: rpcError.message || 'Failed to create invite' }, { status: 400 });
    }

    // Log successful action for audit trail
    console.log(`[/api/employees/invite POST] Admin ${user.id} created invite for ${email} in workspace ${workspace_id} (${planType}: ${currentEmployeeCount}/${maxEmployees})`);

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
