import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PUT /api/super-admin/employees/[id]
 *
 * Update employee details (name, status)
 *
 * Authorization:
 * - super_admin only
 *
 * Request body:
 * {
 *   first_name?: string
 *   last_name?: string
 *   status?: 'active' | 'inactive'
 * }
 *
 * DELETE /api/super-admin/employees/[id]
 *
 * Deactivate an employee
 *
 * Authorization:
 * - super_admin only
 */

async function getAuthenticatedRole(request: NextRequest): Promise<string | null> {
  const admin = createAdminSupabaseClient();
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
      //
    }
  }

  if (!currentUserId) {
    return null;
  }

  const { data: userData } = await admin
    .from('users')
    .select('role')
    .eq('auth_uid', currentUserId)
    .single();

  return userData?.role || null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Check authorization
    const userRole = await getAuthenticatedRole(request);
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Parse body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { first_name, last_name, status } = body;
    const admin = createAdminSupabaseClient();

    // Verify employee belongs to platform workspace
    const { data: employee } = await admin
      .from('employees')
      .select('id, workspace_id')
      .eq('id', employeeId)
      .single();

    if (!employee || employee.workspace_id !== PLATFORM_WORKSPACE_ID) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (status !== undefined) updateData.status = status;

    // Update employee
    const { error: updateError } = await admin
      .from('employees')
      .update(updateData)
      .eq('id', employeeId);

    if (updateError) {
      console.error('[SUPER_ADMIN_PUT] Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update employee' },
        { status: 500 }
      );
    }

    console.log('[SUPER_ADMIN_PUT] Employee updated:', {
      employee_id: employeeId,
      ...updateData,
    });

    return NextResponse.json(
      { success: true, message: 'Employee updated' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[SUPER_ADMIN_PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;

    if (!employeeId) {
      return NextResponse.json(
        { success: false, error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Check authorization
    const userRole = await getAuthenticatedRole(request);
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const admin = createAdminSupabaseClient();

    // Verify employee belongs to platform workspace
    const { data: employee } = await admin
      .from('employees')
      .select('id, workspace_id')
      .eq('id', employeeId)
      .single();

    if (!employee || employee.workspace_id !== PLATFORM_WORKSPACE_ID) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Deactivate employee (set status = 'inactive')
    const { error: updateError } = await admin
      .from('employees')
      .update({ status: 'inactive' })
      .eq('id', employeeId);

    if (updateError) {
      console.error('[SUPER_ADMIN_DELETE] Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to deactivate employee' },
        { status: 500 }
      );
    }

    console.log('[SUPER_ADMIN_DELETE] Employee deactivated:', {
      employee_id: employeeId,
    });

    return NextResponse.json(
      { success: true, message: 'Employee deactivated' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[SUPER_ADMIN_DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
