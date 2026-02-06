import { createServerClient } from '@supabase/ssr';
import { NextResponse, NextRequest } from 'next/server';
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';

// Routes that authenticated users can access WITHOUT a workspace_id
// These are required for onboarding, invite acceptance, and general site access
const ALLOWED_NO_WORKSPACE_ROUTES = [
  '/',
  '/invite',
  '/onboarding',
  '/admin/platform-staff',
];

/**
 * Check if a path is in the allowed no-workspace routes
 * Supports exact matches and path prefixes for directories
 */
function isAllowedWithoutWorkspace(pathname: string): boolean {
  return ALLOWED_NO_WORKSPACE_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  console.log('[Middleware] INVOKED for path:', pathname);
  
  // ===== CRITICAL: ALLOW PUBLIC AUTH ROUTES =====
  // Do NOT protect /auth/* routes - users must be able to access login/signup
  // Also allow /api/auth/* endpoints (login/logout/me) so client-side checks can reach them
  // ===== CRITICAL: ALLOW PUBLIC AUTH ROUTES =====
  // Do NOT protect auth pages or auth APIs - users must be able to access login/signup
  // This allows the client to fully control auth flow and logout navigation.
  if (
    pathname === '/auth' ||
    pathname.startsWith('/auth') ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/api/auth')
  ) {
    console.log('[Middleware] ✓ Public auth route allowed:', pathname);
    return NextResponse.next();
  }
  
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ===== STEP 1: RESOLVE SUPABASE AUTH USER =====
  // Validates JWT server-side (secure). This checks if auth session is valid.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  console.log('[Middleware] User check:', {
    hasUser: !!user,
    userId: user?.id || 'none',
    error: userError?.message || 'none'
  });

  // If no user, DO NOT redirect server-side to login. Treat as unauthenticated (401 equivalent)
  // and allow the request to continue so the client can handle logout navigation. Only
  // true authorization failures (403) should be redirected to /unauthorized.
  if (!user || userError) {
    console.warn('[Middleware] No valid user found - unauthenticated; allowing request to continue');
    // Return the proxied response; client will detect missing session and navigate as needed
    return response;
  }

  // ===== STEP 2: RESOLVE ROLE FROM RPC =====
  // The RPC `rpc_get_user_access()` is the SINGLE source of truth for
  // role + workspace resolution. No table queries are allowed here.
  const result = await supabase.rpc('rpc_get_user_access').single();
  const accessData = result.data;

  if (!accessData) {
    console.warn('[Middleware] ✗ Role resolution failed - no access data');
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  const role = (accessData as any).role as string | null;
  const workspaceId = (accessData as any).workspace_id as string | null;

  console.log('[Middleware] ✓ Role resolution from RPC:', { role, workspaceId });

  // If no role found for an authenticated user, this is an authorization failure (403)
  // and we redirect to the /unauthorized landing so the user sees the right UX.
  if (!role) {
    console.warn('[Middleware] No role found for authenticated user - redirecting to /unauthorized');
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // ===== AUTHORIZATION LOGIC BY ROLE (RPC-DRIVEN) =====
  const url = request.nextUrl.clone();

  // ===== 1️⃣ SUPER ADMIN ROLE (workspace_id = NULL) =====
  if (role === 'super_admin') {
    console.log('[Middleware] Processing super_admin authorization');

    // Super admin MUST NOT have a workspace_id
    if (workspaceId) {
      console.error('[Middleware] ✗ Super admin has workspace_id set - unauthorized state');
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Allow no-workspace routes
    if (isAllowedWithoutWorkspace(pathname)) return response;

    // Allow /super-admin routes
    if (pathname === '/super-admin' || pathname.startsWith('/super-admin/')) return response;

    // Redirect super_admin to /super-admin
    url.pathname = '/super-admin';
    return NextResponse.redirect(url);
  }

  // ===== 2️⃣ CLIENT ADMIN ROLE (workspace_id REQUIRED) =====
  if (role === 'admin') {
    console.log('[Middleware] Processing client_admin authorization');

    // Client admin MUST have a workspace_id
    if (!workspaceId) {
      console.error('[Middleware] ✗ Client admin missing required workspace_id');
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Allow no-workspace routes
    if (isAllowedWithoutWorkspace(pathname)) return response;

    // Allow /admin routes only
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return response;

    // Redirect client admin to /admin
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  // ===== 3️⃣ EMPLOYEE ROLE (workspace_id REQUIRED) =====
  if (role === 'employee') {
    console.log('[Middleware] Processing employee authorization', { workspaceId });

    // Employee MUST have a workspace_id
    if (!workspaceId) {
      console.error('[Middleware] ✗ Employee missing required workspace_id - invalid state');
      return NextResponse.redirect(new URL('/invite', request.url));
    }

    // Allow no-workspace routes
    if (isAllowedWithoutWorkspace(pathname)) return response;

    // Distinguish platform vs client employee by workspace_id
    if (workspaceId === PLATFORM_WORKSPACE_ID) {
      // Platform employee: only allowed on /super-admin/employees
      if (pathname === '/super-admin/employees' || pathname.startsWith('/super-admin/employees/')) return response;
      url.pathname = '/super-admin/employees';
      return NextResponse.redirect(url);
    }

    // Client employee: allow /employees routes (workspace-scoped UI)
    if (pathname === '/employees' || pathname.startsWith('/employees/')) return response;

    // Redirect client employee to /employees/dashboard
    url.pathname = '/employees/dashboard';
    return NextResponse.redirect(url);
  }

  // ===== UNKNOWN ROLE =====
  console.error('[Middleware] Unknown role:', role);
  return NextResponse.redirect(new URL('/unauthorized', request.url));
}

// Apply middleware to relevant routes
export const config = {
  matcher: [
    '/super-admin',
    '/super-admin/:path*',
    '/admin',
    '/admin/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/employees',
    '/employees/:path*'
  ],
};

