import { NextResponse, NextRequest } from 'next/server';
import { db, PLAN_LIMITS } from '@/lib/db';
import { createServerClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';

export async function GET(request: NextRequest) {
  try {
    // Response used only to capture Supabase cookie mutations
    const res = NextResponse.json({});

    // ✅ Use SSR client wired to request/response so cookies are read and written
    // @ts-ignore
    const supabase = createServerClient(request, res as any);

    const { data: userData, error: authError } = await supabase.auth.getUser();
    console.info('[Auth Me] Supabase getUser:',
      userData?.user ? 'FOUND' : 'NOT_FOUND',
      authError ? `Error: ${authError.message}` : ''
    );

    if (authError || !userData?.user) {
      console.warn('[Auth Me] Auth check failed:', authError?.message || 'no user');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUser = userData.user;
    console.info('[Auth Me] auth user id:', authUser.id);

    // ===== AUTHORITATIVE ROLE RESOLUTION (RPC ONLY) =====
    // Use rpc_get_user_access() as the single source of truth for role and workspace
    const result = await supabase.rpc('rpc_get_user_access').single();
    const accessData = result.data;

    if (!accessData) {
      console.warn('[Auth Me] rpc_get_user_access failed or returned no data');
      return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    }

    const role = (accessData as any).role as string;
    const workspaceId = (accessData as any).workspace_id as string | null;

    const finalRes = NextResponse.json(
      {
        session: { user: authUser },
        role,
        workspaceId,
        user: {
          id: authUser.id,
          email: authUser.email || '',
          role,
          workspace_id: workspaceId,
        },
      },
      { status: 200 }
    );

    for (const cookie of res.cookies.getAll()) {
      finalRes.cookies.set(cookie);
    }

    return finalRes;
  } catch (error: any) {
    console.error('[Auth Me] Fatal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}