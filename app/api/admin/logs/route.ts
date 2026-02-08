import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import createServerClient from '@/lib/supabase/server';

async function verifyAdmin(request: Request) {
  const res = NextResponse.json({});
  // @ts-ignore
  const supabase = createServerClient(request as any, res as any);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const rpc = await supabase.rpc('rpc_get_user_access').single();
  const access = rpc.data;
  if (!access) return null;

  const role = (access as any).role as string | null;
  const workspaceId = (access as any).workspace_id as string | null;

  if (role !== 'super_admin') return null;

  return { id: user.id, email: user.email, role, workspaceId } as any;
} 

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logs = await db.logs.getRecent(200);
    
    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('[Admin Logs] Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
