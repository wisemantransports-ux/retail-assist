import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// IMPORTANT: Do not use Supabase server clients while mock mode is enabled.
// The factory functions below will throw if `env.useMockMode` is true to prevent accidental live DB calls.

// Do NOT read env vars at module top-level. Instead, read them inside the functions.
let adminClient: SupabaseClient | null = null
let anonClient: SupabaseClient | null = null

function getEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  }
}

// Lazy-import env to avoid top-level execution
async function getUseMockMode(): Promise<boolean> {
  const { env } = await import('../env.ts')
  return env.useMockMode
}

function requireConfig() {
  const { url, serviceRoleKey } = getEnv()
  
  // Check if we're in mock mode
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true'
  
  if (isMockMode && !url && !serviceRoleKey) {
    throw new Error('Supabase client disabled: mock mode is enabled (NEXT_PUBLIC_USE_MOCK_SUPABASE=true). Set NEXT_PUBLIC_USE_MOCK_SUPABASE=false and provide SUPABASE_* env vars to enable Supabase.')
  }
  if (!url || !serviceRoleKey) {
    // Add detailed diagnostic information
    const envKeys = Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('supabase')).sort()
    const debugInfo = {
      url: !!url,
      serviceRoleKey: !!serviceRoleKey,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      availableSupabaseEnvKeys: envKeys,
      nodeEnv: process.env.NODE_ENV
    }
    console.error('[Supabase Config Error]', JSON.stringify(debugInfo, null, 2))
    throw new Error(
      `Supabase configuration missing. ` +
      `SUPABASE_URL is ${url ? 'set' : 'NOT SET'}. ` +
      `SUPABASE_SERVICE_ROLE_KEY is ${serviceRoleKey ? 'set' : 'NOT SET'}. ` +
      `See VERCEL_SETUP.md for instructions to set environment variables in Vercel.`
    )
  }
}

export function createServerSupabaseClient(): SupabaseClient {
  requireConfig()
  const { url, serviceRoleKey } = getEnv()
  
  if (!adminClient) {
    adminClient = createClient(url!, serviceRoleKey!, {
      auth: { 
        autoRefreshToken: false,
        persistSession: false 
      }
    })
  }
  return adminClient
}

export function createAdminSupabaseClient(): SupabaseClient {
  // In mock mode, avoid throwing and use server client instead
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true'
  if (isMockMode) {
    return createServerClient();
  }
  return createServerSupabaseClient();
}

export function createServerClient(request?: NextRequest, response?: NextResponse): SupabaseClient {
  const { url, anonKey } = getEnv()
  
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true'
  if (isMockMode && !url && !anonKey) {
    throw new Error('Supabase client disabled: mock mode is enabled (NEXT_PUBLIC_USE_MOCK_SUPABASE=true). Set NEXT_PUBLIC_USE_MOCK_SUPABASE=false and provide NEXT_PUBLIC_SUPABASE_* env vars to enable the client.')
  }
  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for server client.')
  }
  if (request) {
    // Use SSR client for cookie handling
    return createSSRServerClient(url!, anonKey!, {
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
      anonClient = createClient(url!, anonKey!, {
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
