import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/employees/invites
 * Returns list of pending invites for the client_admin's workspace
 *
 * SECURITY:
 * - Only client_admin can list invites in their workspace
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

    // Only admins can list pending invites
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    // Admin must have workspace_id
    if (!workspace_id) {
      return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
    }

    // Query pending invites scoped to the admin's workspace
    const { data: invites, error: queryError } = await supabase
      .from('employee_invites')
      .select('id, email, role, status, created_at, expires_at, token')
      .eq('workspace_id', workspace_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[/api/employees/invites GET] Query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
    }

    // Log access for audit trail
    console.log(`[/api/employees/invites GET] Admin ${user.id} fetched pending invites for workspace ${workspace_id}`);

    return NextResponse.json({ invites: invites || [] });
  } catch (error) {
    console.error('[/api/employees/invites GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
