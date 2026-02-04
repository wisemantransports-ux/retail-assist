require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

(async () => {
  const BASE = process.env.BASE_URL || 'http://localhost:3000';
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_* env vars');
    process.exit(2);
  }

  const testEmail = `ci-sync-${Date.now()}@test.dev`;
  const testPassword = 'StrongPass123!';

  try {
    // 1) create user via signup endpoint
    console.log('[CI TEST] Creating user via /api/auth/signup...');
    const signupRes = await fetch(BASE + '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        business_name: 'CI Test Co',
        phone: '+15550000000'
      })
    });

    if (!signupRes.ok) {
      console.error('[CI TEST] Signup failed, status:', signupRes.status);
      process.exit(3);
    }

    // 2) sign in using anon client (client-side)
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON);
    console.log('[CI TEST] Signing in with Supabase client...');
    const { data, error } = await anon.auth.signInWithPassword({ email: testEmail, password: testPassword });

    if (error) {
      console.error('[CI TEST] Supabase sign-in error:', error);
      process.exit(4);
    }

    if (!data?.session) {
      console.error('[CI TEST] No session returned from sign-in');
      process.exit(5);
    }

    // 3) Call /api/auth/sync with tokens
    console.log('[CI TEST] Calling /api/auth/sync to set cookies server-side...');
    const syncRes = await fetch(BASE + '/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
    });

    if (syncRes.status !== 200) {
      console.error('[CI TEST] /api/auth/sync returned non-200 status:', syncRes.status);
      process.exit(6);
    }

    const headers = Object.fromEntries(syncRes.headers.entries());
    const setCookie = headers['set-cookie'] || headers['Set-Cookie'] || headers['set-cookie'];

    if (!setCookie) {
      console.error('[CI TEST] /api/auth/sync did not include Set-Cookie header');
      process.exit(7);
    }

    if (!setCookie.includes('sb-')) {
      console.error('[CI TEST] Set-Cookie header does not contain sb- token:', setCookie);
      process.exit(8);
    }

    console.log('[CI TEST] /api/auth/sync set-cookie header found:', setCookie.split(';')[0]);

    // 4) Call /api/auth/me with cookies we just got by passing them in header
    const cookieHeader = setCookie.split(/,(?=[^,]*=)/).map(s => s.split(';')[0]).join('; ');
    console.log('[CI TEST] Cookie header to pass to /api/auth/me:', cookieHeader);

    const meRes = await fetch(BASE + '/api/auth/me', {
      method: 'GET',
      headers: { 'Cookie': cookieHeader }
    });

    console.log('[CI TEST] /api/auth/me status with cookies:', meRes.status);

    // Accept any non-401 response as proof the cookie is recognized by the server
    if (meRes.status === 401) {
      console.error('[CI TEST] /api/auth/me returned 401 even after syncing cookies');
      process.exit(9);
    }

    console.log('[CI TEST] SUCCESS: Set-Cookie present and /api/auth/me accepted cookie (status', meRes.status + ')');
    process.exit(0);
  } catch (err) {
    console.error('[CI TEST] TEST_ERROR', err);
    process.exit(1);
  }
})();