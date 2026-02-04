import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body || {};

    console.info('[AUTH SYNC] Called', {
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer')
    });

    if (!access_token || !refresh_token) {
      console.warn('[AUTH SYNC] Missing tokens in request body');
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    // Initialize response to capture cookie set operations
    const res = NextResponse.json({});

    // Use SSR client wired to request/response cookies
    // @ts-ignore
    const supabase = createServerClient(request, res as any);

    // Set session server-side so the SSR client writes sb-*-auth-token cookies
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (error) {
      console.error('[AUTH SYNC] setSession error:', error);

      // If the refresh token is invalid or not found, surface a 400 so client can re-auth
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('refresh token') || msg.includes('invalid refresh')) {
        return NextResponse.json({ error: 'Invalid refresh token', details: error?.message || null }, { status: 400 });
      }

      // Generic failure
      return NextResponse.json({ error: 'Failed to set session', details: error?.message || null }, { status: 500 });
    }

    console.info('[AUTH SYNC] setSession succeeded');

    // Copy any Supabase cookies written to `res` into the response we return
    const supabaseCookies = res.cookies.getAll();

    // Log cookie summary for CI debugging (name, path, httpOnly, sameSite, secure, maxAge)
    try {
      const cookieSummary = supabaseCookies.map(c => ({
        name: c.name,
        path: c.path,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        secure: c.secure,
        maxAge: c.maxAge
      }));
      console.info('[AUTH SYNC] Supabase cookies to set:', JSON.stringify(cookieSummary));
    } catch (logErr) {
      console.warn('[AUTH SYNC] Failed to summarize cookies for logging', logErr);
    }

    const finalRes = NextResponse.json({ success: true }, { status: 200 });
    for (const cookie of supabaseCookies) {
      finalRes.cookies.set(cookie.name, cookie.value, cookie);
    }

    return finalRes;
  } catch (err: any) {
    console.error('[AUTH SYNC] unexpected error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}