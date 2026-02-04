import { NextResponse, NextRequest } from 'next/server';
import { db, PLAN_LIMITS } from '@/lib/db';
import { createServerClient, createAdminSupabaseClient } from '@/lib/supabase/server';

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

    // Admin client bypasses RLS safely
    const admin = createAdminSupabaseClient();

    // ===== USERS TABLE LOOKUP =====
    const { data: userDataFromDb, error: userError } = await admin
      .from('users')
      .select('*')
      .eq('auth_uid', authUser.id)
      .single();

    console.info(
      '[Auth Me] user lookup (admin):',
      userDataFromDb ? 'FOUND' : 'NOT_FOUND',
      userError ? `Error: ${userError.message}` : ''
    );

    // ===== EMPLOYEE FALLBACK (NO users ROW) =====
    if (!userDataFromDb) {
      const { data: employeeCheck } = await admin
        .from('employees')
        .select('workspace_id, invited_by_role')
        .eq('auth_uid', authUser.id)
        .maybeSingle();

      if (!employeeCheck) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const finalRes = NextResponse.json(
        {
          session: { user: authUser },
          role: 'employee',
          workspaceId: employeeCheck.workspace_id,
          user: {
            id: authUser.id,
            email: authUser.email || '',
            role: 'employee',
            workspace_id: employeeCheck.workspace_id,
          },
        },
        { status: 200 }
      );

      for (const cookie of res.cookies.getAll()) {
        finalRes.cookies.set(cookie);
      }

      return finalRes;
    }

    const user = userDataFromDb;
    const planLimits = PLAN_LIMITS[user.plan_type] || PLAN_LIMITS.starter;

    // ===== ROLE RESOLUTION (STRICT ORDER) =====
    let role: 'super_admin' | 'admin' | 'employee';
    let workspaceId: string | null = null;

    if (user.role === 'super_admin') {
      role = 'super_admin';
    } else if (user.role === 'client_admin') {
      if (!user.workspace_id) {
        return NextResponse.json(
          { error: 'Invalid admin account state (missing workspace)' },
          { status: 403 }
        );
      }
      role = 'admin';
      workspaceId = user.workspace_id;
    } else {
      const { data: employeeCheck } = await admin
        .from('employees')
        .select('workspace_id')
        .eq('auth_uid', authUser.id)
        .maybeSingle();

      if (!employeeCheck) {
        return NextResponse.json({ error: 'User role not resolved' }, { status: 403 });
      }

      role = 'employee';
      workspaceId = employeeCheck.workspace_id;
    }

    const finalRes = NextResponse.json(
      {
        session: { user: authUser },
        role,
        workspaceId,
        user: {
          id: authUser.id,
          email: user.email,
          business_name: user.business_name,
          phone: user.phone,
          role,
          workspace_id: workspaceId,
          plan_type: user.plan_type,
          plan_name: planLimits.name,
          plan_limits: planLimits,
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