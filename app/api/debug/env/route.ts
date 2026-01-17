import { NextResponse } from 'next/server';

/**
 * Debug Endpoint: Environment Variables
 *
 * Route: GET /api/debug/env
 *
 * Purpose:
 * - Verify Supabase environment variables at runtime
 * - Check that Vercel deployment has correct env vars set
 * - Useful for diagnosing authentication and API connectivity issues
 *
 * Returns:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (status only)
 * - NEXT_PUBLIC_SUPABASE_URL: Public URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Anon key (status only)
 * - NEXT_PUBLIC_USE_MOCK_SUPABASE: Mock Supabase flag
 *
 * Security:
 * - Never exposes actual secret values
 * - Only shows SET/NOT_SET status for secrets
 * - Safe to use in development and production
 *
 * Usage:
 * curl http://localhost:5000/api/debug/env
 * curl https://retail-assist.vercel.app/api/debug/env
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const useMockSupabase = process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE;

    // Verify all critical vars are set
    const allSet = !!supabaseUrl && !!serviceRoleKey && !!publicUrl && !!anonKey;

    return NextResponse.json(
      {
        status: allSet ? 'OK' : 'INCOMPLETE',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        variables: {
          // Private/secret variables - only show SET/NOT_SET
          SUPABASE_URL: supabaseUrl ? 'SET' : 'NOT_SET',
          SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? 'SET (secret)' : 'NOT_SET',
          // Public variables - safe to show
          NEXT_PUBLIC_SUPABASE_URL: publicUrl || 'NOT_SET',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? 'SET' : 'NOT_SET',
          NEXT_PUBLIC_USE_MOCK_SUPABASE: useMockSupabase || 'NOT_SET',
        },
        checks: {
          supabaseUrlSet: !!supabaseUrl,
          serviceRoleKeySet: !!serviceRoleKey,
          publicUrlSet: !!publicUrl,
          anonKeySet: !!anonKey,
          canConnectToSupabase: !!supabaseUrl && !!serviceRoleKey && !!anonKey,
        },
      },
      { status: allSet ? 200 : 500 }
    );
  } catch (error) {
    console.error('[/api/debug/env] Error:', error);
    return NextResponse.json(
      {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

