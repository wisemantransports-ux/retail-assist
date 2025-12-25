import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { sessionManager } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const sessionId = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('session_id='))
      ?.split('=')[1];
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const session = await sessionManager.validate(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const user = await db.users.findById(session.user_id);
    if (!user || user.subscription_status !== 'active') {
      return NextResponse.json({ error: 'Subscription not active' }, { status: 403 });
    }

    const canAdd = await db.users.canAddPage(user.id);
    if (!canAdd.allowed) {
      return NextResponse.json({ error: canAdd.reason }, { status: 403 });
    }

    if (!env.meta.appId || !env.meta.appSecret) {
      return NextResponse.json({ 
        error: 'Meta App not configured. Please contact admin.' 
      }, { status: 500 });
    }

    const url = new URL(request.url);
    const redirectUri = `${url.origin}/api/meta/callback`;
    
    const scopes = [
      'pages_manage_metadata',
      'pages_read_engagement', 
      'pages_messaging',
      'pages_manage_posts',
      'pages_read_user_content',
    ];

    if (await db.users.canUseInstagram(user.id)) {
      scopes.push('instagram_basic', 'instagram_manage_messages', 'instagram_manage_comments');
    }

    const state = Buffer.from(JSON.stringify({ 
      userId: user.id,
      timestamp: Date.now() 
    })).toString('base64');

    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', env.meta.appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes.join(','));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    console.log('[Meta OAuth] Redirecting to Facebook login');
    
    return NextResponse.json({ 
      authUrl: authUrl.toString(),
      scopes 
    });
  } catch (error: any) {
    console.error('[Meta OAuth] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
