import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * DEBUG endpoint to check user access and role resolution
 * GET /api/debug/user-access
 */
export async function GET(request: NextRequest) {
  try {
    // @ts-ignore
    const supabase = createServerClient(request);
    
    // Get current auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        authError: authError?.message 
      }, { status: 401 });
    }

    // Check users table
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', user.id)
      .single();

    // Check admin_access
    const { data: adminAccess, error: adminError } = await supabase
      .from('admin_access')
      .select('*')
      .eq('user_id', userRecord?.id);

    // Check RPC result
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('rpc_get_user_access');

    return NextResponse.json({
      auth_user: {
        id: user.id,
        email: user.email
      },
      users_table: {
        found: !!userRecord,
        data: userRecord,
        error: userError?.message
      },
      admin_access_table: {
        found: adminAccess && adminAccess.length > 0,
        records: adminAccess,
        error: adminError?.message
      },
      rpc_result: {
        data: rpcResult,
        error: rpcError?.message
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
