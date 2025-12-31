import { createClient, SupabaseClient } from '@supabase/supabase-js'

// IMPORTANT: Do not use Supabase server clients while mock mode is enabled.
// The factory functions below will throw if `env.useMockMode` is true to prevent accidental live DB calls.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

import { env } from '../env.ts'

function requireConfig() {
  // Respect mock mode: prevent accidental use of Supabase clients when mock mode is enabled
  if (env.useMockMode) {
    throw new Error('Supabase client disabled: mock mode is enabled (NEXT_PUBLIC_USE_MOCK_SUPABASE=true). Set NEXT_PUBLIC_USE_MOCK_SUPABASE=false and provide SUPABASE_* env vars to enable Supabase.')
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.')
  }
}

let adminClient: SupabaseClient | null = null
let anonClient: SupabaseClient | null = null

export function createServerSupabaseClient(): SupabaseClient {
  requireConfig()
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false }
    })
  }
  return adminClient
}

export function createAdminSupabaseClient(): SupabaseClient {
  return createServerSupabaseClient()
}

export function createServerClient(): SupabaseClient {
  if (env.useMockMode) {
    throw new Error('Supabase client disabled: mock mode is enabled (NEXT_PUBLIC_USE_MOCK_SUPABASE=true). Set NEXT_PUBLIC_USE_MOCK_SUPABASE=false and provide NEXT_PUBLIC_SUPABASE_* env vars to enable the client.')
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for server client.')
  }
  if (!anonClient) {
    anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    })
  }
  return anonClient
}

export async function createMockAdminSupabaseClient(): Promise<any> {
  // Lightweight mock factory. Mirrors `createMockAdminSupabaseClient` in `mock-client.ts`.
  // For now, delegate to existing server client factory to preserve behavior.
  return createServerSupabaseClient();
}

export default createServerSupabaseClient
