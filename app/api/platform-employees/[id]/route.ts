import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: employeeId } = await params;
  if (!employeeId) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  // Auth & role check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roleData, error: roleError } = await supabase.rpc('rpc_get_user_access').single();
  if (roleError || !roleData) return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
  if ((roleData as any).role !== 'super_admin') return NextResponse.json({ error: 'Super admins only' }, { status: 403 });

  // Fetch single platform employee with email join
  const { data: employee, error: queryError } = await supabase
    .from('employees')
    .select(`
      id,
      user_id,
      workspace_id,
      is_active,
      created_at,
      updated_at,
      full_name,
      phone,
      role,
      users!inner(email)
    `)
    .eq('id', employeeId)
    .is('workspace_id', null)
    .single();

  if (queryError) {
    if (queryError.code === 'PGRST116') return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    console.error('[/api/platform-employees/[id] GET] Query error:', queryError);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }

  return NextResponse.json({ employee });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: employeeId } = await params;
  if (!employeeId) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });

  const body = await request.json();
  const { full_name, phone, is_active } = body;

  // Validate inputs if provided
  if (full_name !== undefined && typeof full_name !== 'string') return NextResponse.json({ error: 'Full name must be a string' }, { status: 400 });
  if (phone !== undefined && typeof phone !== 'string') return NextResponse.json({ error: 'Phone must be a string' }, { status: 400 });
  if (is_active !== undefined && typeof is_active !== 'boolean') return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  // Auth & role check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roleData, error: roleError } = await supabase.rpc('rpc_get_user_access').single();
  if (roleError || !roleData) return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
  if ((roleData as any).role !== 'super_admin') return NextResponse.json({ error: 'Super admins only' }, { status: 403 });

  // Build update object with only provided fields
  const updateData: any = {};
  if (full_name !== undefined) updateData.full_name = full_name;
  if (phone !== undefined) updateData.phone = phone;
  if (is_active !== undefined) updateData.is_active = is_active;
  updateData.updated_at = new Date().toISOString();

  // Update platform employee (workspace_id must be null)
  const { data: employee, error: updateError } = await supabase
    .from('employees')
    .update(updateData)
    .eq('id', employeeId)
    .is('workspace_id', null)
    .select(`
      id,
      user_id,
      workspace_id,
      is_active,
      created_at,
      updated_at,
      full_name,
      phone,
      role,
      users!inner(email)
    `)
    .single();

  if (updateError) {
    if (updateError.code === 'PGRST116') return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    console.error('[/api/platform-employees/[id] PUT] Query error:', updateError);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }

  return NextResponse.json({ employee });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: employeeId } = await params;
  if (!employeeId) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  );

  // Auth & role check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roleData, error: roleError } = await supabase.rpc('rpc_get_user_access').single();
  if (roleError || !roleData) return NextResponse.json({ error: 'Unable to determine user role' }, { status: 403 });
  if ((roleData as any).role !== 'super_admin') return NextResponse.json({ error: 'Super admins only' }, { status: 403 });

  // Delete platform employee (workspace_id must be null)
  const { error: deleteError } = await supabase
    .from('employees')
    .delete()
    .eq('id', employeeId)
    .is('workspace_id', null);

  if (deleteError) {
    if (deleteError.code === 'PGRST116') return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    console.error('[/api/platform-employees/[id] DELETE] Query error:', deleteError);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Employee deleted successfully' });
  }