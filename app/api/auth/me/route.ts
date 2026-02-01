import { NextResponse, NextRequest } from 'next/server';
import { createAuthSupabaseClient, applyCookies } from '@/lib/supabase/auth-server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { PLAN_LIMITS } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('[Auth Me] GET /api/auth/me');

    // Create Supabase client with proper cookie handling
    // This reads auth cookies from the request and stores cookies to be set
    const { supabase, cookiesToSet } = createAuthSupabaseClient(request);
    
    // Get authenticated user from cookies
    const { data: userData, error: authError } = await supabase.auth.getUser();
    
    console.log('[Auth Me] getUser result:', {
      found: !!userData?.user,
      error: authError?.message || null
    });

    if (authError || !userData?.user) {
      console.warn('[Auth Me] Auth check failed:', authError?.message || 'no user');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authUser = userData.user;
    console.log('[Auth Me] Authenticated user:', authUser.id);
    
    // Use admin client for database lookups
    const admin = createAdminSupabaseClient();

    // Look up user in users table
    const { data: userDataFromDb, error: userError } = await admin
      .from('users')
      .select('*')
      .eq('auth_uid', authUser.id)
      .single();

    console.log('[Auth Me] Database lookup:', {
      found: !!userDataFromDb,
      error: userError?.message || null
    });

    if (userError && (userError as any).code !== 'PGRST116') { // PGRST116 = not found
      console.error('[Auth Me] Database error:', userError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    let user = userDataFromDb;
    
    // If user not found in users table, check employees table
    if (!user) {
      console.log('[Auth Me] User not in users table, checking employees table');
      
      const { data: employeeCheck } = await admin
        .from('employees')
        .select('id, workspace_id, invited_by_role, auth_uid')
        .eq('auth_uid', authUser.id)
        .maybeSingle();
      
      if (employeeCheck) {
        console.log('[Auth Me] ✓ Employee found (no users row)');
        
        const finalResponse = NextResponse.json({
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
        
        return finalResponse;
      } else {
        console.error('[Auth Me] User not found in users or employees tables');
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }

    const planLimits = PLAN_LIMITS[user.plan_type] || PLAN_LIMITS['starter'];
    
    // ===== ROLE-BASED ACCESS RESOLUTION =====
    // STRICT Priority order:
    // 1) users.role = 'super_admin'
    // 2) users.role = 'client_admin'
    // 3) employees table (employee role)
    
    let role = null;
    let workspaceIdFromRpc = null;
    let employeeScope: 'super_admin' | 'client_admin' | null = null;
    
    console.log('[Auth Me] Resolving role for user:', { id: user.id, dbRole: user.role });
    
    // 1) Check if super_admin
    if (user.role === 'super_admin') {
      role = 'super_admin';
      workspaceIdFromRpc = null;
      console.log('[Auth Me] ✓ Resolved: super_admin');
    }
    
    // 2) Check if client_admin
    if (!role && user.role === 'client_admin') {
      // client_admin MUST have workspace_id
      if (!user.workspace_id) {
        console.error('[Auth Me] client_admin has no workspace_id');
        return NextResponse.json(
          { error: 'Invalid admin account state - workspace not assigned' },
          { status: 403 }
        );
      }

      role = 'admin';
      workspaceIdFromRpc = user.workspace_id;
      console.log('[Auth Me] ✓ Resolved: admin (client_admin), workspace:', workspaceIdFromRpc);
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
        console.log('[Auth Me] ✓ Resolved: employee, workspace:', workspaceIdFromRpc);
      }
    }
    
    // Role must be resolved
    if (!role) {
      console.error('[Auth Me] No role resolved for user:', authUser.id);
      return NextResponse.json(
        { error: 'User role not found - ensure user is properly onboarded' },
        { status: 403 }
      );
    }

    console.log('[Auth Me] ✓ Role resolution complete:', { role, workspaceIdFromRpc });
    
    // Return successful auth response
    const finalResponse = NextResponse.json({
      session: { user: authUser },
      role,
      workspaceId: workspaceIdFromRpc,
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

    // Apply any cookie updates (e.g., refresh token rotation)
    applyCookies(cookiesToSet, finalResponse);

    console.log('[Auth Me] ✓ Auth validation successful');
    return finalResponse;

  } catch (error: any) {
    console.error('[Auth Me] Unexpected error:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
