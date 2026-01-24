import { NextResponse, NextRequest } from 'next/server';
import { db, PLAN_LIMITS } from '@/lib/db';
import { ensureInternalUser } from '@/lib/supabase/queries';
import { env } from '@/lib/env';
import { createServerClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';

export async function GET(request: NextRequest) {
  try {
    // Create response to capture cookie updates
    const res = NextResponse.json({});
    
    // Use Supabase auth with request/response for proper cookie handling
    // @ts-ignore
    const supabase = createServerClient(request, res as any);
    
    const { data: userData, error: authError } = await supabase.auth.getUser();
    console.info('[Auth Me] Supabase getUser:', userData?.user ? 'FOUND' : 'NOT_FOUND', authError ? `Error: ${authError.message}` : '');

    if (authError || !userData?.user) {
      console.warn('[Auth Me] Auth check failed:', authError?.message || 'no user');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authUser = userData.user;
    console.info('[Auth Me] auth user id:', authUser.id);
    
    // Use admin client for user lookups to avoid RLS/policy recursion
    const admin = createAdminSupabaseClient();

    // Look up user in database using admin client
    const { data: userDataFromDb, error: userError } = await admin.from('users').select('*').eq('auth_uid', authUser.id).single();
    console.info('[Auth Me] user lookup (admin):', userDataFromDb ? 'FOUND' : 'NOT_FOUND', userError ? `Error: ${userError.message}` : '');

    if (userError && (userError as any).code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('[Auth Me] user lookup error:', userError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    let user = userDataFromDb;
    if (!user) {
      // Ensure user exists (ensureInternalUser uses admin client internally)
      const ensured = await ensureInternalUser(authUser.id);
      if (!ensured.id) {
        console.error('[Auth Me] failed to ensure user');
        return NextResponse.json({ error: 'User creation failed' }, { status: 500 });
      }
      // Fetch again via admin client
      const { data: newUser } = await admin.from('users').select('*').eq('auth_uid', authUser.id).single();
      user = newUser;
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const planLimits = PLAN_LIMITS[user.plan_type] || PLAN_LIMITS['starter'];
    
    // ===== ROLE-BASED ACCESS RESOLUTION =====
    // Fetch user role and workspace from RPC (returns exactly one row)
    // Possible roles:
    //   - super_admin: workspace_id = NULL
    //   - platform_staff: workspace_id = PLATFORM_WORKSPACE_ID
    //   - admin (client): workspace_id = client workspace id
    //   - employee: workspace_id = assigned workspace id
    const { data: userAccess, error: rpcError } = await supabase.rpc('rpc_get_user_access');
    
    if (rpcError) {
      console.error('[Auth Me] RPC error:', rpcError.message);
      return NextResponse.json({ error: 'Role resolution failed' }, { status: 500 });
    }
    
    const accessRecord = userAccess?.[0];
    const role = accessRecord?.role;
    const workspaceIdFromRpc = accessRecord?.workspace_id;
    
    // Role must be resolved
    if (!role) {
      console.error('[Auth Me] No role resolved for user:', authUser.id);
      return NextResponse.json({ error: 'User role not found' }, { status: 403 });
    }
    
    console.log('[Auth Me] Resolved role:', role);
    console.log('[Auth Me] Workspace ID from RPC:', workspaceIdFromRpc);
    
    // ===== USE WORKSPACE_ID FROM RPC FOR ROUTING =====
    // RPC is the authoritative source for role and workspace_id
    // Client will use these values to determine post-login redirect:
    //   - super_admin (workspace_id = NULL) → /admin
    //   - platform_staff (workspace_id = PLATFORM_WORKSPACE_ID) → /admin/support
    //   - admin (workspace_id = client workspace id) → /dashboard
    //   - employee (workspace_id = assigned workspace id) → /employees/dashboard
    const finalRes = NextResponse.json({
      session: { user: authUser }, // Include session for compatibility with useAuth
      access: accessRecord, // Include full access record
      role, // Include role for easier access
      workspaceId: workspaceIdFromRpc, // Include workspaceId
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        phone: user.phone,
        payment_status: user.payment_status || 'unpaid',
        subscription_status: user.subscription_status,
        plan_type: user.plan_type || 'starter',
        plan_name: planLimits?.name || 'Starter',
        plan_limits: planLimits,
        billing_end_date: user.billing_end_date,
        role: role,
        workspace_id: workspaceIdFromRpc
      }
    }, { status: 200 });
    
    // Copy any Supabase cookies to response to maintain session
    const cookies = res.cookies.getAll();
    for (const cookie of cookies) {
      finalRes.cookies.set(cookie);
    }
    
    return finalRes;
  } catch (error: any) {
    console.error('[Auth Me] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}

