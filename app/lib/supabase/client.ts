import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let client: SupabaseClient | null = null;

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
  // If mock mode is enabled, return stub to avoid dialing Supabase
  if (env.useMockMode) return stubClient as unknown as SupabaseClient;

  // Ensure required client-side env vars exist
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY; falling back to stub client');
    return stubClient as unknown as SupabaseClient;
  }

  if (client) return client;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export const createBrowserClient = createBrowserSupabaseClient;
export const supabase = createBrowserSupabaseClient();
export default createBrowserSupabaseClient;
