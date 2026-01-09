import fs from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

// Load env file manually so this script can be run with `node`/`ts-node`.
function loadEnvFile(envPath = '.env.local') {
  try {
    const abs = path.resolve(process.cwd(), envPath);
    if (!fs.existsSync(abs)) return;
    const src = fs.readFileSync(abs, 'utf8');
    for (const line of src.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = process.env[key] ?? val;
    }
  } catch (err) {
    // ignore
  }
}

loadEnvFile('.env.local');

// Try to import admin client from app/lib/supabaseAdmin.ts as requested.
// Fallback to existing server factory if that file is not present.
let adminClientFactory: (() => SupabaseClient) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const adminModule = require(path.resolve(process.cwd(), 'app/lib/supabaseAdmin'));
  if (adminModule && typeof adminModule.createAdminSupabaseClient === 'function') {
    adminClientFactory = adminModule.createAdminSupabaseClient as () => SupabaseClient;
  } else if (adminModule && adminModule.default && typeof adminModule.default === 'function') {
    adminClientFactory = adminModule.default as () => SupabaseClient;
  }
} catch (e) {
  // fallback
}

if (!adminClientFactory) {
  // fallback to server factory used in this repo
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const server = require(path.resolve(process.cwd(), 'app/lib/supabase/server'));
  if (server && typeof server.createAdminSupabaseClient === 'function') {
    adminClientFactory = server.createAdminSupabaseClient as () => SupabaseClient;
  } else if (server && typeof server.createServerClient === 'function') {
    adminClientFactory = server.createServerClient as () => SupabaseClient;
  }
}

// Public client
let publicSupabase: SupabaseClient | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pub = require(path.resolve(process.cwd(), 'app/lib/supabase'));
  if (pub && pub.supabase) publicSupabase = pub.supabase as SupabaseClient;
  else if (pub && pub.default) publicSupabase = pub.default as unknown as SupabaseClient;
} catch (e) {
  // ignore
}

async function main() {
  if (!adminClientFactory) {
    console.error('Admin Supabase client factory not found. Expected app/lib/supabaseAdmin.ts or app/lib/supabase/server.ts');
    process.exitCode = 1;
    return;
  }
  if (!publicSupabase) {
    console.error('Public Supabase client not found at app/lib/supabase');
    process.exitCode = 1;
    return;
  }

  console.log('Starting test-auth script');

  const admin = adminClientFactory();

  const timestamp = Date.now();
  const testEmail = `test+${timestamp}@example.com`;
  const testPassword = 'Test1234!';

  // 1) Sign up via admin client
  try {
    console.log('[STEP] Admin signUp ->', testEmail);
    const { data: signupData, error: signupError } = await admin.auth.signUp({ email: testEmail, password: testPassword });
    if (signupError) {
      console.error('[RESULT] Admin signUp error:', signupError);
    } else {
      console.log('[RESULT] Admin signUp success:', { hasUser: !!signupData?.user, id: signupData?.user?.id });

      // 2) Upsert profile in internal users table
      try {
        const authUid = signupData?.user?.id;
        if (authUid) {
          console.log('[STEP] Admin upsert profile for auth UID ->', authUid);
          const now = new Date().toISOString();
          const profile = {
            auth_uid: authUid,
            email: testEmail,
            business_name: 'Test Business',
            phone: '0000000000',
            plan_type: 'starter',
            payment_status: 'unpaid',
            subscription_status: 'pending',
            role: 'user',
            created_at: now,
            updated_at: now,
          } as any;

          const { data: profileData, error: profileErr } = await admin.from('users').upsert(profile).select().limit(1).maybeSingle();
          if (profileErr) {
            console.error('[RESULT] Admin profile upsert error:', profileErr);
          } else {
            console.log('[RESULT] Admin profile upserted:', { id: (profileData as any)?.id || null });
          }
        } else {
          console.warn('[WARN] No auth UID returned from admin signUp; skipping profile upsert');
        }
      } catch (e: any) {
        console.error('[ERROR] Profile upsert failed:', e?.message || e);
      }
    }
  } catch (e: any) {
    console.error('[ERROR] Admin signUp flow failed:', e?.message || e);
    process.exitCode = 2;
    return;
  }

  // 3) Sign in using public client
  try {
    console.log('[STEP] Public signInWithPassword ->', testEmail);
    const { data: signInData, error: signInError } = await publicSupabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (signInError) {
      console.error('[RESULT] Public signIn error:', signInError);
      process.exitCode = 3;
    } else {
      console.log('[RESULT] Public signIn success:', { hasUser: !!signInData?.user, hasSession: !!(signInData as any)?.session });
    }
  } catch (e: any) {
    console.error('[ERROR] Public sign-in flow failed:', e?.message || e);
    process.exitCode = 4;
  }

  console.log('test-auth script finished');
}

main().catch((e) => {
  console.error('Unhandled error in test-auth script:', e);
  process.exitCode = 1;
});
