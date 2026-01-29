import { createServerClient } from '@supabase/ssr';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
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

    // Auth & role check via trusted /api/auth/me endpoint
    const authMeRes = await fetch('http://localhost:3000/api/auth/me', {
      headers: { 'Cookie': request.headers.get('cookie') || '' }
    });
    if (!authMeRes.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: authMeRes.status });
    const authMe = await authMeRes.json();

    const resolvedRole = authMe.role;
    const authUser = authMe.user;

    if (resolvedRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Super admins only' },
        { status: 403 }
      );
    }

    console.log('[platform-employees/invites] authorized super_admin:', authUser?.id);

    // Fetch pending invites for platform staff with admin client to bypass RLS
    const admin = createAdminSupabaseClient();
    const { data: invites, error: queryError } = await admin
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
