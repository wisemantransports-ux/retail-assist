/**
 * Stub Supabase client - This app uses file-based JSON storage, not Supabase.
 * These exports exist to satisfy imports without breaking the build.
 */

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
  return stubClient;
}

export const createClient = createBrowserSupabaseClient;
export const supabase = stubClient;
export default createBrowserSupabaseClient;
