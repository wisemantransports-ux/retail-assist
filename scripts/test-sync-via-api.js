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

  const testEmail = `api-sync-${Date.now()}@test.dev`;
  const testPassword = 'StrongPass123!';

  try {
    // 1) create user via signup endpoint
    console.log('Creating user via /api/auth/signup...');
    const signupRes = await fetch(BASE + '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        business_name: 'E2E Test Co',
        phone: '+15550000000'
      })
    });

    console.log('Signup status:', signupRes.status);
    const signupBody = await signupRes.text();
    console.log('Signup body:', signupBody.slice(0, 1000));

    if (!signupRes.ok) {
      console.error('Signup failed');
      process.exit(3);
    }

    // 2) sign in using anon client (client-side)
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON);
    console.log('Signing in with Supabase client...');
    const { data, error } = await anon.auth.signInWithPassword({ email: testEmail, password: testPassword });

    if (error) {
      console.error('Supabase sign-in error:', error);
      process.exit(4);
    }

    console.log('Sign-in session present?', !!data?.session);
    if (!data.session) {
      console.error('No session returned from sign-in');
      process.exit(5);
    }

    // 3) Call /api/auth/sync with tokens
    console.log('Calling /api/auth/sync to set cookies server-side...');
    const syncRes = await fetch(BASE + '/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
    });

    console.log('/api/auth/sync status:', syncRes.status);
    const headers = Object.fromEntries(syncRes.headers.entries());
    console.log('Response headers (partial):', JSON.stringify({ 'set-cookie': headers['set-cookie'] }, null, 2));

    // Inspect set-cookie header
    const sc = headers['set-cookie'] || headers['Set-Cookie'] || headers['set-cookie'];
    if (!sc) {
      console.error('/api/auth/sync did not return Set-Cookie headers');
      process.exit(6);
    }

    console.log('/api/auth/sync set-cookie header:', sc);

    // 4) Call /api/auth/me with cookies we just got by passing them in header
    // Note: In a real browser, cookies set by Set-Cookie are stored automatically.
    // For testing, extract cookies from header and pass them explicitly.
    const cookieHeader = sc.split(/,(?=[^,]*=)/).map(s => s.split(';')[0]).join('; ');
    console.log('Cookie header to pass to /api/auth/me:', cookieHeader);

    const meRes = await fetch(BASE + '/api/auth/me', {
      method: 'GET',
      headers: { 'Cookie': cookieHeader }
    });

    console.log('/api/auth/me status with cookies:', meRes.status);
    const meBody = await meRes.text();
    console.log('/api/auth/me body (truncated):', meBody.slice(0, 1000));

    if (meRes.status === 200) {
      console.log('E2E_OK: /api/auth/me returned 200 when cookie header provided');
      process.exit(0);
    } else {
      console.error('E2E_FAILED: /api/auth/me still failed even after syncing cookies');
      process.exit(7);
    }
  } catch (err) {
    console.error('TEST_ERROR', err);
    process.exit(1);
  }
})();