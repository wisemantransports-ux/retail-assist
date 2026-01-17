import { NextResponse } from 'next/server'

/**
 * DEBUG ENDPOINT - Remove in production
 * Shows which environment variables are available at runtime
 */
export async function GET() {
  const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT_SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
    NEXT_PUBLIC_USE_MOCK_SUPABASE: process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE || 'NOT_SET',
    NODE_ENV: process.env.NODE_ENV,
  }

  // Show all env keys that contain 'SUPABASE'
  const allSupabaseKeys = Object.keys(process.env)
    .filter(k => k.toUpperCase().includes('SUPABASE'))
    .sort()

  return NextResponse.json({
    message: 'Environment variables status',
    envVars,
    allSupabaseKeys,
    timestamp: new Date().toISOString()
  })
}
