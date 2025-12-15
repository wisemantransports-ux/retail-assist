import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/replit-db/session';
import { replitDb } from '@/lib/replit-db';

export async function POST(request: Request) {
  try {
    const sessionId = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('session_id='))
      ?.split('=')[1];
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const session = sessionManager.validate(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId } = body;

    if (!pageId) {
      return NextResponse.json({ error: 'Missing pageId' }, { status: 400 });
    }

    const token = await replitDb.tokens.findByPageId(pageId);
    
    if (!token) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    if (token.user_id !== session.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await replitDb.tokens.delete(token.id);

    await replitDb.logs.add({
      user_id: session.user_id,
      level: 'info',
      message: `Disconnected page: ${token.page_name}`,
      meta: { pageId: token.page_id }
    });

    console.log('[Meta Disconnect] Page disconnected:', token.page_name);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Meta Disconnect] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
