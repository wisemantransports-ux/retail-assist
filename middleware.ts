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

  // ===== STEP 2: RESOLVE ROLE FROM public.users TABLE =====
  // Fetch user role and workspace from tables
  // Priority: users.role='super_admin' → admin_access (admin) → users.role='client_admin' + workspace_members → employees (employee)
  let role = null;
  let workspaceId: string | null = null;

  // Check super_admin role first (super_admin does NOT have workspace_id)
  const { data: superAdminData } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_uid', user.id)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (superAdminData) {
    role = 'super_admin';
    workspaceId = null;
    console.log('[Middleware] ✓ Resolved as super_admin (no workspace required)');
  }

  // Check admin role via admin_access table (with workspace_id)
  if (!role) {
    const { data: adminData } = await supabase
      .from('admin_access')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminData?.workspace_id) {
      role = 'admin';
      workspaceId = adminData.workspace_id;
      console.log('[Middleware] ✓ Resolved as admin for workspace:', workspaceId);
    }
  }

  // Check client_admin role (users.role='client_admin' without admin_access entry yet)
  // This handles the new signup flow where workspace_members is populated but admin_access might not be
  if (!role) {
    const { data: clientAdminData } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_uid', user.id)
      .eq('role', 'client_admin')
      .maybeSingle();

    if (clientAdminData) {
      // User has client_admin role, now find their workspace from workspace_members
      const { data: membershipData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', clientAdminData.id)
        .maybeSingle();

      if (membershipData?.workspace_id) {
        role = 'admin';  // Treat client_admin as admin role
        workspaceId = membershipData.workspace_id;
        console.log('[Middleware] ✓ Resolved as admin (client_admin via workspace_members) for workspace:', workspaceId);
      } else {
        console.warn('[Middleware] ⚠ Client admin found but no workspace membership yet');
      }
    }
  }

  // Check employee role (with workspace_id)
  if (!role) {
    const { data: employeeData } = await supabase
      .from('employees')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (employeeData?.workspace_id) {
      role = 'employee';
      workspaceId = employeeData.workspace_id;
      console.log('[Middleware] ✓ Resolved as employee for workspace:', workspaceId);
    }
  }

  console.log('[Middleware] Role resolution complete:', { role, workspaceId });

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
  // Employee: MUST have workspace_id. Can access /employees/dashboard only.
  // Each employee belongs to EXACTLY ONE workspace (enforced at DB level).
  if (role === 'employee') {
    console.log('[Middleware] Processing employee authorization');
    
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
    
    // ✗ Block employees from /admin, /admin/support, or /dashboard routes
    if (pathname === '/admin' || pathname.startsWith('/admin/') || 
        pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      console.warn('[Middleware] ✗ Employee cannot access protected route:', pathname);
      url.pathname = '/employees/dashboard';
      return NextResponse.redirect(url);
    }
    
    // ✓ Allow /employees/dashboard routes
    if (pathname === '/employees/dashboard' || pathname.startsWith('/employees/dashboard/')) {
      console.log('[Middleware] ✓ Employee allowed on /employees/dashboard routes');
      return response;
    }
    
    // ✗ Not on /employees/dashboard? Redirect there
    console.log('[Middleware] Redirecting employee to /employees/dashboard from:', pathname);
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
    '/admin',
    '/admin/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/employees',
    '/employees/:path*'
  ],
};

