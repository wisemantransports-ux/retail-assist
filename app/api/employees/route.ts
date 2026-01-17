import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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

    const { role, workspace_id } = roleData;

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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

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

    const { role, workspace_id } = roleData;

    // Only admins can create invites
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    // Admin must have workspace_id
    if (!workspace_id) {
      return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
    }

    // Call RPC to create invite (RPC validates authorization + creates scoped invite)
    // AUTHORIZATION: RPC verifies admin is inviting to their own workspace
    const { data: invite, error: rpcError } = await supabase.rpc(
      'rpc_create_employee_invite',
      {
        p_workspace_id: workspace_id,
        p_email: email,
        p_invited_by: user.id,
        p_role: 'employee',
      }
    );

    if (rpcError) {
      console.error('[/api/employees/invite POST] RPC error:', rpcError);
      // RPC errors usually mean authorization failed
      return NextResponse.json({ error: rpcError.message || 'Failed to create invite' }, { status: 400 });
    }

    // Log action for audit trail
    console.log(`[/api/employees/invite POST] Admin ${user.id} created invite for ${email} in workspace ${workspace_id}`);

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
