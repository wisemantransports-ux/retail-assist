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
    // Extract only valid cookie options - Next.js cookies API expects specific properties
    const validOptions = {
      path: (cookie as any).path,
      domain: (cookie as any).domain,
      maxAge: (cookie as any).maxAge,
      expires: (cookie as any).expires,
      httpOnly: (cookie as any).httpOnly,
      secure: (cookie as any).secure,
      sameSite: (cookie as any).sameSite,
    };

    console.log('[Auth Server] Merging cookie:', cookie.name, 'with options:', {
      path: validOptions.path,
      secure: validOptions.secure,
      sameSite: validOptions.sameSite,
      httpOnly: validOptions.httpOnly,
    });

    toResponse.cookies.set(cookie.name, cookie.value, validOptions);
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
