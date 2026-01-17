import { NextResponse } from 'next/server'

/**
 * DEBUG ENDPOINT - Environment Variables Status
 * Shows runtime availability of Supabase configuration
 * Safe for production - does not expose secrets
 */
export async function GET() {
  const envVars = {
    // Private/Secret variables - only show if SET (never show value)
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET (secret)' : 'NOT_SET',
    
    // Public variables - safe to show value
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
    NEXT_PUBLIC_USE_MOCK_SUPABASE: process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE || 'NOT_SET',
  }

  // Diagnostic: List all SUPABASE-related env keys
  const supabaseEnvKeys = Object.keys(process.env)
    .filter(k => k.toUpperCase().includes('SUPABASE'))
    .sort()

  return NextResponse.json({
    message: 'Supabase Environment Variables Status',
    status: {
      hasUrl: !!process.env.SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      canConnectToSupabase: !!(
        (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
    },
    envVars,
    allSupabaseEnvKeys: supabaseEnvKeys,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
}

