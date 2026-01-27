import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing env vars');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function check() {
  const { data } = await admin
    .from('users')
    .select('*')
    .eq('email', 'dev-super-admin@retail-assist.test');
  console.log('Admin user:', JSON.stringify(data, null, 2));
}

check();
