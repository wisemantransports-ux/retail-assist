import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

/**
 * GET /api/meta/instagram/oauth
 * 
 * Initiates Instagram OAuth flow for business accounts.
 * 
 * Security:
 * - Session validation required
 * - Subscription status checked
 * - Plan capacity verified
 * 
 * Returns:
 * - 200: { authUrl, scopes }
 * - 401: Not authenticated
 * - 403: Subscription/plan restrictions
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await sessionManager.validate(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const user = await db.users.findById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // ===== SUBSCRIPTION VALIDATION =====
    if (user.subscription_status !== 'active') {
      return NextResponse.json({ 
        error: 'Active subscription required to connect Instagram' 
      }, { status: 403 });
    }

    // ===== PLAN VALIDATION =====
    const limits = db.users.getPlanLimits(user.plan_type);
    if (!limits.hasInstagram) {
      return NextResponse.json({ 
        error: 'Instagram integration requires Pro plan or higher' 
      }, { status: 403 });
    }

    // ===== CAPACITY CHECK =====
    const canAdd = await db.users.canAddPage(user.id);
    if (!canAdd.allowed) {
      return NextResponse.json({ error: canAdd.reason }, { status: 403 });
    }

    // ===== BUILD OAUTH PARAMETERS =====
    const scopes = [
      'instagram_basic',           // Basic Instagram account access
      'instagram_manage_messages'  // Can read/send DMs
    ];

    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now()
    })).toString('base64');

    const redirectUri = process.env.META_REDIRECT_INSTAGRAM_URI || 
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/instagram/callback`
        : 'http://localhost:3000/api/meta/instagram/callback');

    const authUrl = new URL('https://www.instagram.com/oauth/authorize');
    authUrl.searchParams.append('client_id', env.meta.appId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', scopes.join(','));
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);

    console.log('[Instagram OAuth] Initiated for user:', user.email);

    return NextResponse.json({
      authUrl: authUrl.toString(),
      scopes
    });

  } catch (error: any) {
    console.error('[Instagram OAuth] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
