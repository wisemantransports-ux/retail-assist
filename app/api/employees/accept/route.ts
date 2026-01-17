import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/employees/accept
 * Accepts an employee invite token
 * 
 * SECURITY:
 * - No authentication required (new employees haven't been created yet)
 * - RPC validates token and prevents multi-workspace assignment
 * - UNIQUE constraint in database prevents employee from being in multiple workspaces
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, full_name, phone, password } = body;

    // Validate inputs
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!full_name || typeof full_name !== 'string') {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

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

    // Call RPC to accept invite
    // RPC validates:
    // - Token exists and is pending
    // - Token is not expired
    // - User is not already employee in another workspace (SINGLE_WORKSPACE enforcement)
    // - User is not already admin
    const { data: acceptResult, error: rpcError } = await supabase.rpc(
      'rpc_accept_employee_invite',
      {
        p_token: token,
        p_full_name: full_name,
        p_phone: phone || null,
      }
    );

    if (rpcError) {
      console.error('[/api/employees/accept POST] RPC error:', rpcError);
      // Common errors:
      // - Invalid or already used invite token
      // - User is already an employee in another workspace (SINGLE_WORKSPACE violation)
      // - User is already an admin (DUAL_ROLE prevention)
      return NextResponse.json({ error: rpcError.message || 'Failed to accept invite' }, { status: 400 });
    }

    // RPC returns (user_id, workspace_id)
    const result = Array.isArray(acceptResult) ? acceptResult[0] : acceptResult;
    const { user_id, workspace_id } = result;

    if (!user_id) {
      return NextResponse.json({ error: 'Failed to create employee record' }, { status: 500 });
    }

    // Now create auth account for this user with the provided password
    // Note: In production, you might want to skip password and use email confirmation instead
    // For now, we'll set the password if not already created
    const { data: authUser, error: signUpError } = await supabase.auth.signUp({
      email: result.email, // Email from invite
      password,
    });

    if (signUpError) {
      // If user already exists, that's okay - they just need to set password
      console.log('[/api/employees/accept POST] Auth signup note:', signUpError);
      // Continue anyway since employee record was created
    }

    // Log action for audit trail
    console.log(`[/api/employees/accept POST] User ${user_id} accepted invite to workspace ${workspace_id}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Invite accepted successfully. Please log in with your new account.',
        redirect: '/login',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[/api/employees/accept POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
