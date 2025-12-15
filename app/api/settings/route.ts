import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { replitDb } from '@/lib/replit-db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = sessionCookie.value;
    const settings = await replitDb.settings.findByUserId(userId);
    
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
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = sessionCookie.value;
    const body = await request.json();

    const updatedSettings = await replitDb.settings.update(userId, {
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
