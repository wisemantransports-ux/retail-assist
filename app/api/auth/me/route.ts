import { NextResponse, NextRequest } from 'next/server';
import { db, PLAN_LIMITS } from '@/lib/db';
import { ensureInternalUser } from '@/lib/supabase/queries';
import { env } from '@/lib/env';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Use Supabase auth
    // @ts-ignore
    const supabase = createServerClient(request);
    const { data: userData, error: authError } = await supabase.auth.getUser();
    console.info('[Auth Me] Supabase getUser:', userData?.user ? 'FOUND' : 'NOT_FOUND', authError ? `Error: ${authError.message}` : '');

    if (authError || !userData?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authUser = userData.user;
    
    // Look up user in database
    console.info('[Auth Me] auth user id:', authUser.id);
    
    // Use Supabase for user lookup to ensure consistency
    const { data: userDataFromDb, error: userError } = await supabase.from('users').select('*').eq('auth_uid', authUser.id).single();
    console.info('[Auth Me] user lookup:', userDataFromDb ? 'FOUND' : 'NOT_FOUND', userError ? `Error: ${userError.message}` : '');
    
    if (userError && userError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('[Auth Me] user lookup error:', userError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    let user = userDataFromDb;
    if (!user) {
      // Ensure user exists
      const ensured = await ensureInternalUser(authUser.id);
      if (!ensured.id) {
        console.error('[Auth Me] failed to ensure user');
        return NextResponse.json({ error: 'User creation failed' }, { status: 500 });
      }
      // Fetch again
      const { data: newUser } = await supabase.from('users').select('*').eq('auth_uid', authUser.id).single();
      user = newUser;
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const planLimits = PLAN_LIMITS[user.plan_type] || PLAN_LIMITS['starter'];
    
    // TASK B1: Fetch user's workspace ID for proper scoping
    // Query workspace by owner_id (assumes 1:1 relationship for now)
    let workspaceId = user.id; // fallback to user.id
    try {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single();
      
      if (workspace?.id) {
        workspaceId = workspace.id;
        console.info('[Auth Me] Workspace found:', workspaceId);
      }
    } catch (err: any) {
      console.warn('[Auth Me] Workspace fetch failed, falling back to user.id:', err.message);
      // Fallback to user.id if workspace lookup fails
      workspaceId = user.id;
    }
    
    // Fetch role from RPC
    const { data: userAccess } = await supabase.rpc('rpc_get_user_access');
    const accessRecord = userAccess?.[0];
    const role = accessRecord?.role || 'user';
    const workspaceIdFromRpc = accessRecord?.workspace_id;
    
    console.log('[Auth Me] Resolved role:', role);
    console.log('[Auth Me] Workspace ID from RPC:', workspaceIdFromRpc);
    
    return NextResponse.json({
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
        workspace_id: workspaceId  // NEW: Added for dashboard workspace scoping
      }
    });
  } catch (error: any) {
    console.error('[Auth Me] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
