import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/super-admin/employees
 *
 * List all employees in PLATFORM_WORKSPACE_ID
 *
 * Authorization:
 * - super_admin only
 *
 * Returns:
 * - Array of employees with id, email, name, status, created_at
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from cookies
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create admin client (bypasses RLS)
    const admin = createAdminSupabaseClient();

    // Get current user from auth header (JWT from cookie)
    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const {
          data: { user },
        } = await admin.auth.getUser(token);
        currentUserId = user?.id || null;
      } catch (err) {
        console.log('[SUPER_ADMIN_EMPLOYEES_GET] Could not decode JWT');
      }
    }

    // Fetch current user to check role
    let userRole = null;
    if (currentUserId) {
      const { data: userData } = await admin
        .from('users')
        .select('role')
        .eq('auth_uid', currentUserId)
        .single();

      userRole = userData?.role;
    }

    // Authorization check: only super_admin
    if (userRole !== 'super_admin') {
      console.log('[SUPER_ADMIN_EMPLOYEES_GET] Access denied for role:', userRole);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    console.log('[SUPER_ADMIN_EMPLOYEES_GET] Fetching platform employees');

    // Get all employees in PLATFORM_WORKSPACE_ID
    const { data: employees, error: employeesError } = await admin
      .from('employees')
      .select('id, email, first_name, last_name, status, created_at, workspace_id')
      .eq('workspace_id', PLATFORM_WORKSPACE_ID)
      .order('created_at', { ascending: false });

    if (employeesError) {
      console.error('[SUPER_ADMIN_EMPLOYEES_GET] Query error:', employeesError);
      return NextResponse.json(
        { success: false, error: 'Failed to load employees' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        employees: employees || [],
        count: employees?.length || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[SUPER_ADMIN_EMPLOYEES_GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
