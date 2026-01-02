import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Environment variables
 * - Public: used by browser + server
 * - Service role: server-only (admin operations)
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Guards
 */
function assertPublicConfig() {
  if (env.useMockMode) {
    throw new Error(
      'Supabase disabled: mock mode is enabled (NEXT_PUBLIC_USE_MOCK_SUPABASE=true)'
    )
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing Supabase public config. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }
}

function assertServiceConfig() {
  if (env.useMockMode) {
    throw new Error(
      'Supabase disabled: mock mode is enabled (NEXT_PUBLIC_USE_MOCK_SUPABASE=true)'
    )
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing Supabase service role config. Set SUPABASE_SERVICE_ROLE_KEY'
    )
  }
}

/**
 * Singleton clients (important for Netlify + Next.js)
 */
let anonClient: SupabaseClient | null = null
let adminClient: SupabaseClient | null = null

/**
 * 🔐 Server-side client (uses anon key)
 * Used for auth/session validation
 */
export function createServerClient(): SupabaseClient {
  assertPublicConfig()

  if (!anonClient) {
    anonClient = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )
  }

  return anonClient
}

/**
 * 👑 Admin client (service role)
 * Used ONLY in API routes for admin tasks
 */
export function createAdminSupabaseClient(): SupabaseClient {
  assertServiceConfig()

  if (!adminClient) {
    adminClient = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )
  }

  return adminClient
}
