import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('[Meta Callback] Auth error:', error);
      return NextResponse.redirect(new URL('/dashboard/integrations?error=auth_denied', url.origin));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/dashboard/integrations?error=missing_params', url.origin));
    }

    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return NextResponse.redirect(new URL('/dashboard/integrations?error=invalid_state', url.origin));
    }

    const { userId } = stateData;
    if (!userId) {
      return NextResponse.redirect(new URL('/dashboard/integrations?error=invalid_state', url.origin));
    }

    const user = await db.users.findById(userId);
    if (!user) {
      return NextResponse.redirect(new URL('/dashboard/integrations?error=user_not_found', url.origin));
    }

    const redirectUri = `${url.origin}/api/meta/callback`;
    
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', env.meta.appId);
    tokenUrl.searchParams.set('client_secret', env.meta.appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    console.log('[Meta Callback] Exchanging code for token');
    
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[Meta Callback] Token error:', tokenData.error);
      return NextResponse.redirect(new URL('/dashboard/integrations?error=token_exchange_failed', url.origin));
    }

    const userAccessToken = tokenData.access_token;

    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${userAccessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error('[Meta Callback] Pages fetch error:', pagesData.error);
      return NextResponse.redirect(new URL('/dashboard/integrations?error=pages_fetch_failed', url.origin));
    }

    const pages = pagesData.data || [];
    console.log('[Meta Callback] Found pages:', pages.length);

    const tempToken = Buffer.from(JSON.stringify({
      userId,
      userAccessToken,
      pages: pages.map((p: any) => ({
        id: p.id,
        name: p.name,
        access_token: p.access_token,
        category: p.category
      })),
      timestamp: Date.now()
    })).toString('base64');

    return NextResponse.redirect(
      new URL(`/dashboard/integrations?success=true&pages=${pages.length}&token=${tempToken}`, url.origin)
    );
  } catch (error: any) {
    console.error('[Meta Callback] Unexpected error:', error.message);
    return NextResponse.redirect(new URL('/dashboard/integrations?error=unexpected', (new URL(request.url)).origin));
  }
}
