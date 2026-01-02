import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionManager } from '@/lib/session';
import { cookies } from 'next/headers';

async function verifyAdmin(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  if (!sessionId) return null;

  const session = await sessionManager.validate(sessionId);
  if (!session) return null;

  const user = await db.users.findById(session.user_id);
  if (!user || user.role !== 'admin') return null;

  return user;
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
