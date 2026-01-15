import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// IMPORTANT: Do not use Supabase server clients while mock mode is enabled.
// The factory functions below will throw if `env.useMockMode` is true to prevent accidental live DB calls.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

import { env } from '../env.ts'

function requireConfig() {
  // Respect mock mode: prevent accidental use of Supabase clients when mock mode is enabled
  // but allow creation if real Supabase credentials are present in the environment.
  const hasServerCreds = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
  if (env.useMockMode && !hasServerCreds) {
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
  if (env.useMockMode) {
    // In mock/dev mode, delegate to the server client (anon) to avoid throwing
    return createServerClient();
  }
  return createServerSupabaseClient();
}

export function createServerClient(request?: NextRequest, response?: NextResponse): SupabaseClient {
  const hasAnonCreds = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  if (env.useMockMode && !hasAnonCreds) {
    throw new Error('Supabase client disabled: mock mode is enabled (NEXT_PUBLIC_USE_MOCK_SUPABASE=true). Set NEXT_PUBLIC_USE_MOCK_SUPABASE=false and provide NEXT_PUBLIC_SUPABASE_* env vars to enable the client.')
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for server client.')
  }
  if (request) {
    // Use SSR client for cookie handling
    return createSSRServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          if (response) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          }
        },
      },
    })
  } else {
    // Fallback for places without request (e.g., server components using cookies())
    if (!anonClient) {
      anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: false }
      })
    }
    return anonClient
  }
}

export async function createMockAdminSupabaseClient(): Promise<any> {
  // Backwards compatibility: previously code used `createMockAdminSupabaseClient` to get
  // a dev-friendly admin client. Delegate to `createAdminSupabaseClient` which
  // now handles mock-mode branching.
  return createAdminSupabaseClient();
}

// Default to the recommended server client export
export default createServerClient
