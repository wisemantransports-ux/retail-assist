/**
 * Server-side Supabase auth client for Next.js API routes.
 *
 * SINGLE SOURCE OF TRUTH: All server API routes (/api/auth/*) must use this utility
 * to create a Supabase client that properly handles session cookies.
 *
 * Usage in API routes:
 * ```typescript
 * import { createAuthSupabaseClient, applyCookies } from '@/lib/supabase/auth-server';
 *
 * export async function GET(request: NextRequest) {
 *   const { supabase, cookiesToSet } = createAuthSupabaseClient(request);
 *
 *   // Use supabase for auth operations
 *   const { data } = await supabase.auth.getUser();
 *
 *   // Create response and apply cookies
 *   const response = NextResponse.json({ success: true });
 *   applyCookies(cookiesToSet, response);
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
 * - Stores cookies that need to be set
 * - Properly configures cookie options (sameSite, path, secure)
 *
 * @param request - Next.js API request
 * @returns { supabase, cookiesToSet } - Supabase client and array of cookies to set in response
 */
export function createAuthSupabaseClient(request: NextRequest): {
  supabase: SupabaseClient;
  cookiesToSet: Array<{ name: string; value: string; options: any }>;
} {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
    );
  }

  // Store cookies that need to be set - we'll set them in the final response
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];

  // Create SSR client with proper cookie handling
  const supabase = createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // Read cookies from incoming request
      getAll() {
        const cookies = request.cookies.getAll();
        console.log('[Auth Server] Reading cookies from request:', cookies.map(c => c.name).join(', ') || '(none)');
        return cookies;
      },
      // Store cookies to be set later in the final response
      setAll(incomingCookies) {
        console.log('[Auth Server] Storing', incomingCookies.length, 'cookies to set in response');
        incomingCookies.forEach(({ name, value, options }) => {
          // CRITICAL: Merge options with defaults
          const cookieOptions = {
            ...options,
            path: options?.path || '/',
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
          };

          console.log('[Auth Server] Storing cookie:', {
            name,
            options: cookieOptions,
          });

          cookiesToSet.push({ name, value, options: cookieOptions });
        });
      },
    },
  });

  return { supabase, cookiesToSet };
}

/**
 * Apply stored cookies to a response object.
 *
 * @param cookiesToSet - Array of cookies from createAuthSupabaseClient
 * @param response - Response to set cookies in
 */
export function applyCookies(
  cookiesToSet: Array<{ name: string; value: string; options: any }>,
  response: NextResponse
): void {
  console.log('[Auth Server] Applying', cookiesToSet.length, 'cookies to response');

  cookiesToSet.forEach(({ name, value, options }) => {
    console.log('[Auth Server] Applying cookie:', name, 'with value length:', value.length);

    // Extract only valid Next.js cookie options
    const validOptions = {
      path: options?.path,
      domain: options?.domain,
      maxAge: options?.maxAge,
      expires: options?.expires,
      httpOnly: options?.httpOnly,
      secure: options?.secure,
      sameSite: options?.sameSite,
    };

    // Remove undefined values
    Object.keys(validOptions).forEach(key => {
      if (validOptions[key as keyof typeof validOptions] === undefined) {
        delete validOptions[key as keyof typeof validOptions];
      }
    });

    console.log('[Auth Server] Cookie options:', Object.keys(validOptions).join(', '));
    response.cookies.set(name, value, validOptions);
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
