import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/platform-employees
 * POST /api/platform-employees
 * Platform-scoped employee management (super_admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    );

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Role check
    const { data: roleData, error: roleError } = await supabase.rpc('rpc_get_user_access').single();
    if (roleError || !roleData) return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    if ((roleData as any).role !== 'super_admin') return NextResponse.json({ error: 'Super admins only' }, { status: 403 });

    // Fetch platform employees with joined email from auth.users
    const { data: employees, error: queryError } = await supabase
      .from('employees')
      .select(`
        id,
        user_id,
        workspace_id,
        is_active,
        created_at,
        updated_at,
        full_name,
        phone,
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

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    );

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve auth user to internal users.id using auth_uid
    // This is required for FK constraint: employee_invites.invited_by -> users.id
    const { data: internalUser, error: userLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_uid', user.id)
      .maybeSingle();

    if (userLookupError || !internalUser) {
      console.error('[/api/platform-employees POST] Failed to resolve internal user ID:', {
        auth_uid: user.id,
        error: userLookupError?.message,
      });
      return NextResponse.json({ error: 'Unable to resolve user profile' }, { status: 401 });
    }

    const internal_user_id = internalUser.id;

    // Role check
    const { data: roleData, error: roleError } = await supabase.rpc('rpc_get_user_access').single();
    if (roleError || !roleData) return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    if ((roleData as any).role !== 'super_admin') return NextResponse.json({ error: 'Super admins only' }, { status: 403 });

    // Create invite via RPC scoped to platform (workspace_id = null)
    // Pass the authenticated super_admin's internal user ID as the inviter
    const { data: invite, error: rpcError } = await supabase.rpc('rpc_create_employee_invite', {
      p_email: email,
      p_role: role || 'employee',
      p_workspace_id: null,
      p_invited_by: internal_user_id,
    });

    if (rpcError) {
      console.error('[/api/platform-employees POST] RPC error:', rpcError);
      return NextResponse.json({ error: rpcError.message || 'Failed to create invite' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Invite created successfully',
      invite: {
        id: invite[0]?.invite_id,
        token: invite[0]?.token,
        email,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[/api/platform-employees POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}