import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/employees/[id]
 * Returns a single employee details (admin only)
 * 
 * SECURITY:
 * - Only admins can view employee details
 * - Employees must be in the admin's workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's role and workspace from RPC
    const { data: roleData, error: roleError } = await supabase
      .rpc('rpc_get_user_access')
      .single();

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    }

    const { role, workspace_id } = roleData as { role: string; workspace_id: string };

    // Only admins can view employee details
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    if (!workspace_id) {
      return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
    }

    // Query employee scoped to admin's workspace
    // WORKSPACE SCOPING: Only return employees in this admin's workspace
    const { data: employee, error: queryError } = await supabase
      .from('employees')
      .select('id, user_id, workspace_id, is_active, created_at, updated_at')
      .eq('id', employeeId)
      .eq('workspace_id', workspace_id)
      .single();

    if (queryError) {
      if (queryError.code === 'PGRST116') {
        // Not found - either doesn't exist or not in this workspace
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      console.error('[/api/employees/[id] GET] Query error:', queryError);
      return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('[/api/employees/[id] GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/employees/[id]
 * Updates an employee (admin only)
 * 
 * SECURITY:
 * - Only admins can update employees in their workspace
 * - Cannot change employee's workspace_id
 * - Workspace scoping prevents cross-workspace updates
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    const body = await request.json();
    const { full_name, phone, is_active } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's role and workspace from RPC
    const { data: roleData, error: roleError } = await supabase
      .rpc('rpc_get_user_access')
      .single();

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    }

    const { role, workspace_id } = roleData as { role: string; workspace_id: string };

    // Only admins can update employees
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    if (!workspace_id) {
      return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
    }

    // First, verify employee exists in this workspace
    const { data: employee, error: checkError } = await supabase
      .from('employees')
      .select('id, workspace_id')
      .eq('id', employeeId)
      .eq('workspace_id', workspace_id)
      .single();

    if (checkError || !employee) {
      return NextResponse.json({ error: 'Employee not found or access denied' }, { status: 404 });
    }

    // Update employee (workspace_id cannot be changed)
    // WORKSPACE SCOPING: Only update employees in this workspace
    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: updated, error: updateError } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', employeeId)
      .eq('workspace_id', workspace_id)
      .select()
      .single();

    if (updateError) {
      console.error('[/api/employees/[id] PUT] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
    }

    // Log action for audit trail
    console.log(`[/api/employees/[id] PUT] Admin ${user.id} updated employee ${employeeId} in workspace ${workspace_id}`);

    return NextResponse.json({ employee: updated });
  } catch (error) {
    console.error('[/api/employees/[id] PUT] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/employees/[id]
 * Removes an employee (admin only, hard delete)
 * 
 * SECURITY:
 * - Only admins can delete employees in their workspace
 * - Workspace scoping prevents cross-workspace deletions
 * - Employee record is permanently removed
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's role and workspace from RPC
    const { data: roleData, error: roleError } = await supabase
      .rpc('rpc_get_user_access')
      .single();

    if (roleError || !roleData) {
      return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
    }

    const { role, workspace_id } = roleData as { role: string; workspace_id: string };

    // Only admins can delete employees
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    if (!workspace_id) {
      return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
    }

    // First, verify employee exists in this workspace
    const { data: employee, error: checkError } = await supabase
      .from('employees')
      .select('id, workspace_id')
      .eq('id', employeeId)
      .eq('workspace_id', workspace_id)
      .single();

    if (checkError || !employee) {
      return NextResponse.json({ error: 'Employee not found or access denied' }, { status: 404 });
    }

    // Delete employee
    // WORKSPACE SCOPING: Only delete employees in this workspace
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)
      .eq('workspace_id', workspace_id);

    if (deleteError) {
      console.error('[/api/employees/[id] DELETE] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
    }

    // Log action for audit trail
    console.log(`[/api/employees/[id] DELETE] Admin ${user.id} deleted employee ${employeeId} from workspace ${workspace_id}`);

    return NextResponse.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('[/api/employees/[id] DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
