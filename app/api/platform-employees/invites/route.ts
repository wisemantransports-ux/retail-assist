import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/platform-employees/invites
 * Fetch all pending employee invites (platform staff only)
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

    // Fetch pending invites for platform staff (workspace_id = null)
    const { data: invites, error: queryError } = await supabase
      .from('employee_invites')
      .select('*')
      .is('workspace_id', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[/api/platform-employees/invites GET] Query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch pending invites' }, { status: 500 });
    }

    return NextResponse.json({ invites: invites || [] });
  } catch (error) {
    console.error('[/api/platform-employees/invites GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
