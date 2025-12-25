/*
  scripts/supabase-policy-test.js

  Usage:
    Copy `.env.example` to `.env.local` and fill keys. Then run:
      node scripts/supabase-policy-test.js

  This script will:
  - Sign in (or sign up if missing) a test user using email/password
  - Use the user's JWT to GET agents for a workspace (should succeed)
  - Attempt to POST a new agent (should be blocked when workspace is pending)
  - Use the service role key to set workspace to 'active'
  - Retry POST agent (should succeed when active)

  Environment vars required (set in .env.local):
    NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY
    TEST_USER_EMAIL
    TEST_USER_PASSWORD
    TEST_WORKSPACE_ID

*/

const fetch = global.fetch || require('node-fetch');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;
const WID = process.env.TEST_WORKSPACE_ID;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !TEST_EMAIL || !TEST_PASSWORD || !WID) {
  console.error('Missing required env vars. See script header.');
  process.exit(1);
}

async function signIn(email, password) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.access_token) return body.access_token;
  return null;
}

async function signUp(email, password) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/signup`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? true : false;
}

async function getAgentsAsUser(jwt) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/agents?workspace_id=eq.${WID}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_KEY }
  });
  return { status: res.status, body: await res.text() };
}

async function createAgentAsUser(jwt) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/agents`;
  const payload = { workspace_id: WID, name: `script-test-${Date.now()}`, description: 'Created by test script' };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function setWorkspaceStatus(status) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/workspaces?id=eq.${WID}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ subscription_status: status })
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main(){
  console.log('Signing in test user...');
  let jwt = await signIn(TEST_EMAIL, TEST_PASSWORD);
  if (!jwt) {
    console.log('User not found or sign-in failed — attempting signup...');
    const ok = await signUp(TEST_EMAIL, TEST_PASSWORD);
    if (!ok) {
      console.error('Signup failed — ensure your Supabase project allows open signup or create the user manually.');
      process.exit(2);
    }
    console.log('Signup requested. Attempting sign-in again...');
    jwt = await signIn(TEST_EMAIL, TEST_PASSWORD);
    if (!jwt) {
      console.error('Sign-in still failed. Check email confirmation settings or create the user manually.');
      process.exit(3);
    }
  }
  console.log('Signed in — JWT acquired (shortened):', jwt.slice(0,30) + '...');

  console.log('\n1) GET agents as user (should succeed for members)');
  let r = await getAgentsAsUser(jwt);
  console.log('GET agents HTTP', r.status, r.body.slice(0,400));

  console.log('\n2) Attempt to create agent as user (expected: blocked if workspace pending)');
  r = await createAgentAsUser(jwt);
  console.log('POST agent HTTP', r.status, r.body.slice(0,400));

  console.log('\n3) Set workspace to active using service role');
  let s = await setWorkspaceStatus('active');
  console.log('PATCH workspace HTTP', s.status, s.body.slice(0,400));

  console.log('\n4) Retry create agent as user (expected: succeed when active)');
  r = await createAgentAsUser(jwt);
  console.log('POST agent HTTP', r.status, r.body.slice(0,400));

  console.log('\n5) Revert workspace to pending (cleanup)');
  s = await setWorkspaceStatus('pending');
  console.log('PATCH workspace HTTP', s.status, s.body.slice(0,400));

  console.log('\nDone. Inspect outputs above — status codes 2xx indicate allowed, 4xx/401/403 indicate RLS blocked for the user context.');
}

main().catch(err => { console.error(err); process.exit(99); });
