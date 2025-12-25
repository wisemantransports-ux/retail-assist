import { createClient, SupabaseClient } from '@supabase/supabase-js';

let srv: SupabaseClient | null = null;

/**
 * Returns a server-side supabase client using the service role key.
 * WARNING: Never expose the returned client to the browser.
 */
export function getServiceSupabaseClient(): SupabaseClient {
  if (srv) return srv;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  srv = createClient(url, key, {
    auth: { persistSession: false },
  });
  return srv;
}
