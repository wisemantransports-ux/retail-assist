import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { sessionManager } from '@/lib/session';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session_id');
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await sessionManager.validate(sessionCookie.value);
    if (!session) {
      const res = NextResponse.json({ error: 'Session expired' }, { status: 401 });
      res.cookies.delete('session_id');
      return res;
    }

    const user = await db.users.findById(session.user_id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const settings = await db.settings.findByUserId(user.id);
    if (!settings) {
      return NextResponse.json({ 
        settings: {
          auto_reply_enabled: true,
          comment_to_dm_enabled: true,
          greeting_message: '',
          away_message: '',
          keywords: [],
          ai_enabled: true,
          system_prompt: ''
        }
      });
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('[Settings API] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session_id');
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await sessionManager.validate(sessionCookie.value);
    if (!session) {
      const res = NextResponse.json({ error: 'Session expired' }, { status: 401 });
      res.cookies.delete('session_id');
      return res;
    }

    const user = await db.users.findById(session.user_id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();

    const updatedSettings = await db.settings.update(user.id, {
      auto_reply_enabled: body.auto_reply_enabled ?? true,
      comment_to_dm_enabled: body.comment_to_dm_enabled ?? true,
      greeting_message: body.greeting_message || '',
      away_message: body.away_message || '',
      keywords: body.keywords || [],
      ai_enabled: body.ai_enabled ?? true,
      system_prompt: body.system_prompt || ''
    });

    return NextResponse.json({ settings: updatedSettings, success: true });
  } catch (error: any) {
    console.error('[Settings API] PUT error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
