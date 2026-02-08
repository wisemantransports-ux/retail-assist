import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import createServerClient from '@/lib/supabase/server';

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

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

export async function PATCH(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body;

    if (password && password.length >= 6) {
      const salt = generateSalt();
      const password_hash = await hashPasswordWithSalt(password, salt);
      await db.users.update(admin.id, { password_hash } as any);

      await db.logs.add({
        user_id: admin.id,
        level: 'info',
        message: 'Admin password updated'
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
  } catch (error: any) {
    console.error('[Admin Settings] Error:', error.message);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
