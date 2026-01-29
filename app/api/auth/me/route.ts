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
      // CRITICAL: DO NOT call ensureInternalUser - it would create a users row for employees
      // Check employees table directly instead
      const { data: employeeCheck } = await admin
        .from('employees')
        .select('id, workspace_id, invited_by_role, auth_uid')
        .eq('auth_uid', authUser.id)
        .maybeSingle();
      
      // If employee found, handle as employee (no users row)
      if (employeeCheck) {
        console.log('[Auth Me] ✓ Employee found (no users row) - role resolution via employees table');
        // Return employee response directly
        const finalRes = NextResponse.json({
          session: { user: authUser },
          role: 'employee',
          workspaceId: employeeCheck.workspace_id,
          user: {
            id: authUser.id,
            email: authUser.email || '',
            business_name: '',
            phone: '',
            payment_status: 'unpaid',
            subscription_status: 'active',
            plan_type: 'starter',
            plan_name: 'Starter',
            plan_limits: PLAN_LIMITS['starter'],
            role: 'employee',
            workspace_id: employeeCheck.workspace_id
          }
        }, { status: 200 });
        
        // Copy any Supabase cookies to response to maintain session
        const cookies = res.cookies.getAll();
        for (const cookie of cookies) {
          finalRes.cookies.set(cookie);
        }
        
        return finalRes;
      } else {
        // Not found in users or employees
        console.error('[Auth Me] User not found in users or employees tables');
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }
    
    const planLimits = PLAN_LIMITS[user.plan_type] || PLAN_LIMITS['starter'];
    
    // ===== ROLE-BASED ACCESS RESOLUTION =====
    // Use direct table queries instead of RPC (more reliable)
    // ===== ROLE-BASED ACCESS RESOLUTION =====
    // STRICT Priority order (DETERMINISTIC):
    // 1) users.role = 'super_admin'
    // 2) users.role = 'client_admin'
    // 3) employees table (employee role)
    // CRITICAL: Must match login endpoint. Employees from employees table ONLY
    let role = null;
    let workspaceIdFromRpc = null;
    let employeeScope: 'super_admin' | 'client_admin' | null = null;
    
    console.log('[Auth Me] DEBUG: user object from DB:', { id: user.id, role: user.role, auth_uid: user.auth_uid });
    
    // 1) Check if super_admin (role already in user object from select('*'))
    if (user.role === 'super_admin') {
      role = 'super_admin';
      workspaceIdFromRpc = null;
      console.log('[Auth Me] ✓ Resolved role: super_admin (priority 1) from user object');
    }
    
    // 2) Check if client_admin (users table)
    // CRITICAL: client_admin MUST have workspace_id set
    if (!role) {
      if (user.role === 'client_admin') {
        // ===== ADMIN SCOPE ENFORCEMENT =====
        // client_admin.workspace_id MUST NOT be NULL
        if (!user.workspace_id) {
          console.error('[Auth Me] ✗ Invalid client_admin state: workspace_id is NULL', {
            user_id: user.id,
            role: 'client_admin',
          });
          return NextResponse.json(
            { error: 'Invalid admin account state - workspace not assigned' },
            { status: 403 }
          );
        }

        role = 'admin';  // Treat client_admin as admin role
        workspaceIdFromRpc = user.workspace_id;
        console.log('[Auth Me] ✓ Resolved role: admin (client_admin, priority 2), workspace:', workspaceIdFromRpc);
      }
    }
    
    // 3) Check employees table (ONLY authoritative source for employee role)
    if (!role) {
      const { data: employeeCheck } = await admin
        .from('employees')
        .select('workspace_id, invited_by_role')
        .eq('auth_uid', authUser.id)
        .maybeSingle();
      
      if (employeeCheck) {
        role = 'employee';
        workspaceIdFromRpc = employeeCheck.workspace_id;
        employeeScope = employeeCheck.invited_by_role || 'client_admin';
        console.log('[Auth Me] ✓ Resolved role: employee (priority 3), invited_by:', employeeScope, ', workspace:', workspaceIdFromRpc);
      }
    }
    
    // Role must be resolved
    if (!role) {
      console.error('[Auth Me] ✗ No role resolved for user:', authUser.id);
        console.error('[Auth Me] Troubleshooting: Verify user in users table has role field set, or migration 039 applied for employees table');
      return NextResponse.json({ error: 'User role not found - ensure user is properly onboarded' }, { status: 403 });
    }
    
    console.log('[Auth Me] ✓ Role resolution complete:', { role, workspaceIdFromRpc, employeeScope });
    
    // Copy any Supabase cookies to response to maintain session
    // Client will use these values to determine post-login redirect:
    //   - super_admin (workspace_id = NULL) → /admin
    //   - admin (workspace_id = client workspace id) → /dashboard
    //   - employee (workspace_id = assigned workspace id) → /employees/dashboard
    const finalRes = NextResponse.json({
      session: { user: authUser }, // Include session for compatibility with useAuth
      role, // Include role for easier access
      workspaceId: workspaceIdFromRpc, // Include workspaceId
      user: {
        id: authUser.id,
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
    console.error('[Auth Me] Unexpected error:', error?.message || error);
    console.error('[Auth Me] Error stack:', error?.stack);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

