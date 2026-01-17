import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Lazy factory function — do NOT read env vars at module top-level.
// Environment variables are only available at runtime, not during build.
let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    _adminClient = createClient(url, key);
  }

  return _adminClient;
}

// Deprecated: use getSupabaseAdmin() instead
// Kept for backwards compatibility but will throw at runtime if called
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get: () => {
    throw new Error('Direct supabaseAdmin export is deprecated. Use getSupabaseAdmin() instead.');
  },
});