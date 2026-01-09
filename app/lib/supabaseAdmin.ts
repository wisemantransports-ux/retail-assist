import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from './env'; // adjust path if needed

if (!env.supabase.url || !env.supabase.serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in env.supabase');
}

export const supabaseAdmin: SupabaseClient = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey
);