/**
 * Server-side Supabase auth client for Next.js API routes.
 * 
 * SINGLE SOURCE OF TRUTH: All server API routes (/api/auth/*) must use this utility
 * to create a Supabase client that properly handles session cookies.
 * 
 * Usage in API routes:
 * ```typescript
 * import { createAuthSupabaseClient } from '@/lib/supabase/auth-server';
 * 
 * export async function GET(request: NextRequest) {
 *   const { supabase, response } = createAuthSupabaseClient(request);
 *   
 *   // Use supabase for auth operations
 *   const { data } = await supabase.auth.getUser();
 *   
 *   // Return the response (cookies are automatically set)
 *   return response;
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createSSRServerClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Create an authenticated Supabase client for server-side API routes.
 * 
 * This client:
 * - Reads auth cookies from the incoming request
 * - Validates the session server-side
 * - Automatically sets any updated cookies in the response
 * - Properly configures cookie options (sameSite, path, secure)
 * 
 * @param request - Next.js API request
 * @returns { supabase, response } - Supabase client and response object with cookies
 */
export function createAuthSupabaseClient(request: NextRequest): {
  supabase: SupabaseClient;
  response: NextResponse;
} {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
    );
  }

  // Create a NextResponse to capture cookies
  const response = NextResponse.json({});

  // Create SSR client with proper cookie handling
  // This client will:
  // 1. Read cookies from the incoming request
  // 2. Call setAll() when auth methods set cookies
  // 3. Properly format cookies with options
  const supabase = createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // Read cookies from incoming request
      getAll() {
        console.log('[Auth Server] Reading cookies from request');
        return request.cookies.getAll();
      },
      // Set cookies in the response
      setAll(cookiesToSet) {
        console.log('[Auth Server] Setting', cookiesToSet.length, 'cookies in response');
        cookiesToSet.forEach(({ name, value, options }) => {
          // CRITICAL: Must merge with default options
          const cookieOptions = {
            ...options,
            path: options?.path || '/',
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
          };
          
          console.log('[Auth Server] Setting cookie:', {
            name,
            options: cookieOptions,
          });
          
          response.cookies.set(name, value, cookieOptions);
        });
      },
    },
  });

  return { supabase, response };
}

/**
 * Merge cookies from intermediate response into final response.
 * 
 * When you create multiple responses during request processing,
 * use this to ensure all cookies are included in the final response.
 * 
 * @param fromResponse - Response with cookies to copy
 * @param toResponse - Response to set cookies in
 */
export function mergeCookies(
  fromResponse: NextResponse,
  toResponse: NextResponse
): void {
  const cookies = fromResponse.cookies.getAll();
  console.log('[Auth Server] Merging', cookies.length, 'cookies from intermediate response');
  
  cookies.forEach((cookie) => {
    console.log('[Auth Server] Merging cookie:', cookie.name);
    toResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
}

/**
 * Check if a request has a valid Supabase session.
 * 
 * @param request - Next.js API request
 * @returns true if valid session exists, false otherwise
 */
export async function hasValidSession(request: NextRequest): Promise<boolean> {
  try {
    const { supabase } = createAuthSupabaseClient(request);
    const { data, error } = await supabase.auth.getSession();
    
    const hasSession = !error && !!data?.session;
    console.log('[Auth Server] Session check:', hasSession ? 'VALID' : 'INVALID');
    
    return hasSession;
  } catch (error) {
    console.error('[Auth Server] Error checking session:', error);
    return false;
  }
}
