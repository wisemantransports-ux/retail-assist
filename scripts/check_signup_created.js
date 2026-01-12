const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  const txt = fs.readFileSync(envPath, 'utf8');
  const lines = txt.split(/\r?\n/);
  const out = {};
  for (const l of lines) {
    const m = l.match(/^([^#=\s]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

(async () => {
  const env = loadEnv();
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(2);
  }

  const email = 'frontendverify3@test.dev';
  const base = SUPABASE_URL.replace(/\/+$/, '');
  const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept': 'application/json' };

  // Helper
  const fetch = global.fetch || (await import('node-fetch')).default;

  // 1) users row
  const ures = await fetch(`${base}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`, { headers });
  const users = await ures.json();
  console.log('USERS_RESULT_COUNT=' + (Array.isArray(users) ? users.length : 0));
  if (!Array.isArray(users) || users.length === 0) {
    console.error('FAIL: users row not found for', email);
    process.exit(3);
  }
  const user = users[0];
  console.log('USER_ID=' + user.id);

  // 2) workspace created (owner_id == user.id)
  const wres = await fetch(`${base}/rest/v1/workspaces?owner_id=eq.${encodeURIComponent(user.id)}&select=*`, { headers });
  const workspaces = await wres.json();
  console.log('WORKSPACES_COUNT=' + (Array.isArray(workspaces) ? workspaces.length : 0));
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    console.error('FAIL: workspace not found for user', user.id);
    process.exit(4);
  }
  const workspace = workspaces[0];
  console.log('WORKSPACE_ID=' + workspace.id);

  // 3) workspace_members entry
  const mres = await fetch(`${base}/rest/v1/workspace_members?user_id=eq.${encodeURIComponent(user.id)}&workspace_id=eq.${encodeURIComponent(workspace.id)}&select=*`, { headers });
  const members = await mres.json();
  console.log('WORKSPACE_MEMBERS_COUNT=' + (Array.isArray(members) ? members.length : 0));
  if (!Array.isArray(members) || members.length === 0) {
    console.error('FAIL: workspace_members not found for user/workspace');
    process.exit(5);
  }

  // 4) admin_access entry
  const ares = await fetch(`${base}/rest/v1/admin_access?user_id=eq.${encodeURIComponent(user.id)}&select=*`, { headers });
  const adminAccess = await ares.json();
  console.log('ADMIN_ACCESS_COUNT=' + (Array.isArray(adminAccess) ? adminAccess.length : 0));

  console.log('PASS: all checks present');
  process.exit(0);
})();
