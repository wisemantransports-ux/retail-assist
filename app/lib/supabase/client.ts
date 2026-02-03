import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// CRITICAL: Module-level singleton - only ONE instance should ever exist
let client: SupabaseClient | null = null;
let initializationAttempts = 0;

const createChainableMock = () => {
  const chain: any = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    eq: () => chain,
    neq: () => chain,
    gt: () => chain,
    lt: () => chain,
    gte: () => chain,
    lte: () => chain,
    like: () => chain,
    ilike: () => chain,
    is: () => chain,
    in: () => chain,
    contains: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return chain;
};

const stubClient = {
  from: (table: string) => createChainableMock(),
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signInWithPassword: (...args: any[]) => Promise.resolve({ data: null, error: null }),
    signUp: (...args: any[]) => Promise.resolve({ data: null, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: (...args: any[]) => Promise.resolve({ data: null, error: null }),
    updateUser: (...args: any[]) => Promise.resolve({ data: null, error: null }),
    onAuthStateChange: (...args: any[]) => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  rpc: () => Promise.resolve({ data: null, error: null }),
};

export function createBrowserSupabaseClient() {
  initializationAttempts++;

  // If we're not in a browser environment, return the stub client
  if (typeof window === 'undefined') {
    console.debug('[Supabase Client] SSR detected, returning stub client');
    return stubClient as unknown as SupabaseClient;
  }

  // If already initialized, return cached client (prevents "Multiple GoTrueClient instances" warning)
  if (client) {
    console.debug('[Supabase Client] Returning cached client instance (attempt #' + initializationAttempts + ')');
    return client;
  }

  // Ensure required client-side env vars exist
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // If mock mode is enabled, return stub to avoid dialing Supabase
  if (env.useMockMode && (!url || !key)) {
    console.debug('[Supabase Client] Mock mode enabled, returning stub client');
    return stubClient as unknown as SupabaseClient;
  }

  // If credentials missing, return stub (will log once at module load)
  if (!url || !key) {
    console.warn('[Supabase Client] Missing credentials, falling back to stub client');
    return stubClient as unknown as SupabaseClient;
  }

  // ===== CREATE THE ONE AND ONLY CLIENT INSTANCE =====
  console.log('[Supabase Client] Creating singleton instance (URL: ' + url.substring(0, 20) + '..., env: browser)');
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      storage: undefined,
      autoRefreshToken: true
    }
  });

  return client;
}

export const createBrowserClient = createBrowserSupabaseClient;
export const supabase = createBrowserSupabaseClient();
export default createBrowserSupabaseClient;
