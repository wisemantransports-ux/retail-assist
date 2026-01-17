import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * GET /api/meta/instagram/callback
 * 
 * Handles Instagram OAuth callback.
 * 
 * Steps:
 * 1. Validate state parameter (CSRF protection)
 * 2. Exchange code for access token
 * 3. Fetch user's Instagram Business accounts
 * 4. Create temporary token with accounts data
 * 5. Redirect to integrations page with token
 * 
 * Query params:
 * - code: Authorization code from Instagram
 * - state: CSRF protection state
 * - error: Error code if denied/failed
 * - error_reason: User-friendly error message
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorReason = url.searchParams.get('error_reason');

    console.log('[Instagram Callback] Received callback:', {
      code: code ? '***' : 'missing',
      state: state ? '***' : 'missing',
      error: error || 'none'
    });

    // ===== HANDLE AUTH DENIAL =====
    if (error) {
      console.warn('[Instagram Callback] Authorization denied:', error, errorReason);
      return redirect(`/dashboard/integrations?error=${error}`);
    }

    // ===== VALIDATE REQUIRED PARAMS =====
    if (!code || !state) {
      console.error('[Instagram Callback] Missing code or state');
      return redirect('/dashboard/integrations?error=missing_params');
    }

    // ===== VALIDATE STATE (CSRF PROTECTION) =====
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      console.error('[Instagram Callback] Invalid state format');
      return redirect('/dashboard/integrations?error=invalid_state');
    }

    const { userId, timestamp } = tokenData;
    const stateAge = Date.now() - timestamp;
    const stateTimeout = 10 * 60 * 1000; // 10 minutes

    if (stateAge > stateTimeout) {
      console.warn('[Instagram Callback] State expired:', stateAge, 'ms');
      return redirect('/dashboard/integrations?error=invalid_state');
    }

    // ===== FETCH USER =====
    const user = await db.users.findById(userId);
    if (!user) {
      console.error('[Instagram Callback] User not found:', userId);
      return redirect('/dashboard/integrations?error=unexpected');
    }

    // ===== EXCHANGE CODE FOR ACCESS TOKEN =====
    let accessTokenResponse;
    try {
      const tokenUrl = 'https://graph.instagram.com/v19.0/oauth/access_token';
      const tokenParams = new URLSearchParams({
        client_id: env.meta.appId,
        client_secret: env.meta.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: process.env.META_REDIRECT_INSTAGRAM_URI || 
          (process.env.NEXT_PUBLIC_APP_URL 
            ? `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/instagram/callback`
            : 'http://localhost:3000/api/meta/instagram/callback'),
        code
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        body: tokenParams,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      accessTokenResponse = await response.json();

      if (!response.ok || !accessTokenResponse.access_token) {
        console.error('[Instagram Callback] Token exchange failed:', accessTokenResponse);
        return redirect('/dashboard/integrations?error=token_exchange_failed');
      }
    } catch (error) {
      console.error('[Instagram Callback] Token exchange error:', error);
      return redirect('/dashboard/integrations?error=token_exchange_failed');
    }

    const accessToken = accessTokenResponse.access_token;
    const userId_ig = accessTokenResponse.user_id;

    // ===== FETCH INSTAGRAM BUSINESS ACCOUNTS =====
    let accountsData;
    try {
      const graphUrl = `https://graph.instagram.com/v19.0/${userId_ig}/accounts`;
      const response = await fetch(`${graphUrl}?access_token=${accessToken}&fields=id,name,username,profile_picture_url`);
      accountsData = await response.json();

      if (!response.ok || !accountsData.data) {
        console.error('[Instagram Callback] Failed to fetch accounts:', accountsData);
        return redirect('/dashboard/integrations?error=pages_fetch_failed');
      }
    } catch (error) {
      console.error('[Instagram Callback] Account fetch error:', error);
      return redirect('/dashboard/integrations?error=pages_fetch_failed');
    }

    const accounts = accountsData.data.map((account: any) => ({
      id: account.id,
      name: account.name || account.username || 'Unknown Account',
      username: account.username,
      access_token: accessToken,
      picture_url: account.profile_picture_url
    }));

    if (accounts.length === 0) {
      console.warn('[Instagram Callback] No Instagram accounts found');
      return redirect('/dashboard/integrations?error=unexpected');
    }

    // ===== CREATE TEMPORARY TOKEN =====
    const tempToken = Buffer.from(JSON.stringify({
      userId: user.id,
      accounts,
      timestamp: Date.now()
    })).toString('base64');

    console.log('[Instagram Callback] Created temp token for user:', user.email, 'accounts:', accounts.length);

    // ===== REDIRECT WITH TOKEN =====
    return redirect(
      `/dashboard/integrations?ig_success=true&ig_token=${tempToken}&ig_accounts=${accounts.length}`
    );

  } catch (error: any) {
    console.error('[Instagram Callback] Unexpected error:', error.message);
    return redirect('/dashboard/integrations?error=unexpected');
  }
}
