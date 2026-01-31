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
  // Also allow /api/auth routes that don't require authentication
  if (pathname.startsWith('/auth/') || pathname === '/login' || pathname === '/signup') {
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

  // If no user, redirect to login
  if (!user || userError) {
    console.warn('[Middleware] No valid user found, redirecting to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ===== STEP 2: RESOLVE ROLE FROM DATABASE =====
  // Fetch user role and workspace from tables
  // STRICT Priority (DETERMINISTIC):
  // 1) users.role = 'super_admin'
  // 2) users.role = 'client_admin'
  // 3) employees table (ONLY source of employee role)
  // Employees are NEVER stored in users.role
  let role = null;
  let workspaceId: string | null = null;
  let employeeScope: 'super_admin' | 'client_admin' | null = null;

  // 1) Check super_admin role first
  const { data: superAdminData } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_uid', user.id)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (superAdminData) {
    role = 'super_admin';
    workspaceId = null;
    console.log('[Middleware] ✓ Resolved as super_admin (priority 1)');
  }

  // 2) Check client_admin role
  if (!role) {
    const { data: clientAdminData } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_uid', user.id)
      .eq('role', 'client_admin')
      .maybeSingle();

    if (clientAdminData) {
      role = 'admin';  // Treat client_admin as admin role
      
      // User has client_admin role, now find their workspace from workspace_members
      const { data: membershipData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', clientAdminData.id)
        .maybeSingle();

      if (membershipData?.workspace_id) {
        workspaceId = membershipData.workspace_id;
        console.log('[Middleware] ✓ Resolved as admin (client_admin, priority 2), workspace:', workspaceId);
      } else {
        console.log('[Middleware] ✓ Resolved as admin (client_admin, priority 2) but no workspace');
      }
    }
  }

  // 3) Check employees table (ONLY authoritative source for employee role)
  if (!role) {
    const { data: employeeData } = await supabase
      .from('employees')
      .select('workspace_id, invited_by_role')
      .eq('auth_uid', user.id)
      .maybeSingle();

    if (employeeData?.workspace_id) {
      role = 'employee';
      workspaceId = employeeData.workspace_id;
      employeeScope = employeeData.invited_by_role || 'client_admin';
      console.log('[Middleware] ✓ Resolved as employee (priority 3), invited_by:', employeeScope, ', workspace:', workspaceId);
    }
  }

  console.log('[Middleware] ✓ Role resolution complete:', { role, workspaceId, employeeScope });

  // If no role found, redirect to unauthorized
  if (!role) {
    console.warn('[Middleware] No role found for user, redirecting to /unauthorized');
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // ===== AUTHORIZATION LOGIC BY ROLE =====
  const url = request.nextUrl.clone();

  // ===== 1️⃣ SUPER ADMIN ROLE (workspace_id = NULL - NOT REQUIRED) =====
  // Super admin: No workspace required. Can access /admin and no-workspace routes.
  // CRITICAL: NEVER redirect authenticated super_admin back to login (prevent loops)
  if (role === 'super_admin') {
    console.log('[Middleware] Processing super_admin authorization');
    
    // ✓ Super admin MUST NOT have a workspace_id
    if (workspaceId) {
      console.error('[Middleware] ✗ Super admin has workspace_id set - unauthorized state');
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // ✓ Allow super admin to access no-workspace routes (onboarding, invites, etc.)
    if (isAllowedWithoutWorkspace(pathname)) {
      console.log('[Middleware] ✓ Super admin allowed on no-workspace route:', pathname);
      return response;
    }
    
    // ✗ Block super admin from client-specific routes
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || 
        pathname === '/employees' || pathname.startsWith('/employees/')) {
      console.warn('[Middleware] ✗ Super admin cannot access client route:', pathname);
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
    
    // ✓ Allow /admin and its sub-routes
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      console.log('[Middleware] ✓ Super admin allowed on /admin routes');
      return response;
    }
    
    // ✗ Not on /admin? Redirect there
    console.log('[Middleware] Redirecting super_admin to /admin from:', pathname);
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }


  // ===== 2️⃣ CLIENT ADMIN ROLE (workspace_id REQUIRED) =====
  // Admin: MUST have workspace_id. Can access /dashboard only.
  if (role === 'admin') {
    console.log('[Middleware] Processing client_admin authorization');
    
    // ✗ Client admin MUST have a workspace_id
    if (!workspaceId) {
      console.error('[Middleware] ✗ Client admin missing required workspace_id');
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // ✓ Allow admin to access no-workspace routes (onboarding, invites, etc.)
    if (isAllowedWithoutWorkspace(pathname)) {
      console.log('[Middleware] ✓ Admin allowed on no-workspace route:', pathname);
      return response;
    }
    
    // ✗ Block admin from /admin or /employees routes
    if (pathname === '/admin' || pathname.startsWith('/admin/') || 
        pathname === '/employees' || pathname.startsWith('/employees/')) {
      console.warn('[Middleware] ✗ Admin cannot access protected route:', pathname);
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    
    // ✓ Allow /dashboard routes
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      console.log('[Middleware] ✓ Admin allowed on /dashboard routes');
      return response;
    }
    
    // ✗ Not on /dashboard? Redirect there
    console.log('[Middleware] Redirecting admin to /dashboard from:', pathname);
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }


  // ===== 3️⃣ EMPLOYEE ROLE (workspace_id REQUIRED) =====
  // Employee: MUST have workspace_id. Routing depends on employeeScope (who invited them)
  // - Platform employee (super_admin invited) → /employees/dashboard
  // - Client employee (client_admin invited) → /dashboard/employees
  if (role === 'employee') {
    console.log('[Middleware] Processing employee authorization', {
      employeeScope,
      workspace: workspaceId
    });
    
    // ✗ Employee MUST have a workspace_id
    if (!workspaceId) {
      console.error('[Middleware] ✗ Employee missing required workspace_id - invalid state');
      return NextResponse.redirect(new URL('/invite', request.url));
    }
    
    // ✓ Allow employees to access no-workspace routes (onboarding, invites, etc.)
    if (isAllowedWithoutWorkspace(pathname)) {
      console.log('[Middleware] ✓ Employee allowed on no-workspace route:', pathname);
      return response;
    }
    
    // PLATFORM EMPLOYEE (super_admin invited) → /employees/dashboard
    if (employeeScope === 'super_admin') {
      console.log('[Middleware] Platform employee (super_admin scope) routing');
      
      // ✗ Block platform employees from /admin or /dashboard routes
      if (pathname === '/admin' || pathname.startsWith('/admin/') || 
          pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        console.warn('[Middleware] ✗ Platform employee cannot access admin/dashboard route:', pathname);
        url.pathname = '/employees/dashboard';
        return NextResponse.redirect(url);
      }
      
      // ✓ Allow /employees/dashboard routes
      if (pathname === '/employees/dashboard' || pathname.startsWith('/employees/dashboard/')) {
        console.log('[Middleware] ✓ Platform employee allowed on /employees/dashboard');
        return response;
      }
      
      // ✗ Not on /employees/dashboard? Redirect there
      console.log('[Middleware] Redirecting platform employee to /employees/dashboard from:', pathname);
      url.pathname = '/employees/dashboard';
      return NextResponse.redirect(url);
    }
    
    // CLIENT EMPLOYEE (client_admin invited) → /dashboard/employees
    else if (employeeScope === 'client_admin') {
      console.log('[Middleware] Client employee (client_admin scope) routing');
      
      // ✗ Block client employees from /admin or /employees routes
      if (pathname === '/admin' || pathname.startsWith('/admin/') || 
          pathname === '/employees' || pathname.startsWith('/employees/')) {
        console.warn('[Middleware] ✗ Client employee cannot access admin/employees route:', pathname);
        url.pathname = `/dashboard/${workspaceId}/employees`;
        return NextResponse.redirect(url);
      }
      
      // ✓ Allow /dashboard routes (workspace-scoped)
      if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        console.log('[Middleware] ✓ Client employee allowed on /dashboard');
        return response;
      }
      
      // ✗ Not on /dashboard? Redirect there
      console.log('[Middleware] Redirecting client employee to workspace dashboard from:', pathname);
      url.pathname = `/dashboard/${workspaceId}/employees`;
      return NextResponse.redirect(url);
    }
    
    // FALLBACK: Unknown employee scope
    console.warn('[Middleware] Employee with unknown scope, redirecting to safe route');
    const defaultRoute = employeeScope === 'super_admin' ? '/employees/dashboard' : `/dashboard/${workspaceId}/employees`;
    url.pathname = defaultRoute;
    return NextResponse.redirect(url);
  }

  // ===== UNKNOWN ROLE =====
  console.error('[Middleware] Unknown role:', role);
  return NextResponse.redirect(new URL('/unauthorized', request.url));
}

// Apply middleware to relevant routes
export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/employees',
    '/employees/:path*'
  ],
};

