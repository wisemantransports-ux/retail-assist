import { createServerClient } from '@supabase/ssr';
import { NextResponse, NextRequest } from 'next/server';

// Platform workspace ID for internal Retail Assist staff
const PLATFORM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

export async function middleware(request: NextRequest) {
  console.log('[Middleware] INVOKED for path:', request.nextUrl.pathname);
  
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

  // Get current session - MUST read from Supabase Auth via cookies
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  console.log('[Middleware] Session check:', {
    hasSession: !!session,
    userId: session?.user?.id || 'none',
    error: sessionError?.message || 'none',
    cookies: request.cookies.getAll().map(c => c.name)
  });

  // If no session, redirect to login
  if (!session || sessionError) {
    console.warn('[Middleware] No valid session found, redirecting to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Fetch user role and workspace from RPC (returns exactly one row)
  const { data: userAccess, error: rpcError } = await supabase.rpc('rpc_get_user_access');
  
  if (rpcError) {
    console.error('[Middleware] RPC error:', rpcError.message);
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  const accessRecord = userAccess?.[0];
  const role = accessRecord?.role;
  const workspaceId = accessRecord?.workspace_id;

  console.log('[Middleware] Resolved role:', role);
  console.log('[Middleware] Workspace ID:', workspaceId);

  // If RPC returns no role, redirect to unauthorized
  if (!role) {
    console.warn('[Middleware] No role found for user, redirecting to /unauthorized');
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // ===== 1️⃣ SUPER ADMIN ROLE (workspace_id = NULL) =====
  // Route: /admin only
  if (role === 'super_admin') {
    console.log('[Middleware] Processing super_admin access');
    
    // Verify super admin never has a workspace_id
    if (workspaceId !== null && workspaceId !== undefined) {
      console.error('[Middleware] Super admin has workspace_id set - unauthorized state');
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // Block super admin from accessing client dashboards or employee routes
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || 
        pathname === '/employees' || pathname.startsWith('/employees/') ||
        pathname === '/admin/support' || pathname.startsWith('/admin/support/')) {
      console.warn('[Middleware] Super admin attempted to access protected route:', pathname, '- redirecting to /admin');
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
    
    // Redirect to admin if not already there
    if (!pathname.startsWith('/admin')) {
      url.pathname = '/admin';
      console.log('[Middleware] Redirecting super_admin to /admin');
      return NextResponse.redirect(url);
    }
    
    return response;
  }

  // ===== 2️⃣ PLATFORM STAFF ROLE (workspace_id = PLATFORM_WORKSPACE_ID) =====
  // Route: /admin/support only
  if (role === 'platform_staff') {
    console.log('[Middleware] Processing platform_staff access for workspace:', workspaceId);
    
    // Verify platform staff has the correct workspace_id
    if (workspaceId !== PLATFORM_WORKSPACE_ID) {
      console.error('[Middleware] Platform staff has incorrect workspace_id:', workspaceId, 'expected:', PLATFORM_WORKSPACE_ID);
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // Block platform staff from accessing other routes
    if (pathname === '/admin' || pathname.startsWith('/admin/') && !pathname.startsWith('/admin/support') ||
        pathname === '/dashboard' || pathname.startsWith('/dashboard/') ||
        pathname === '/employees' || pathname.startsWith('/employees/')) {
      console.warn('[Middleware] Platform staff attempted to access protected route:', pathname, '- redirecting to /admin/support');
      url.pathname = '/admin/support';
      return NextResponse.redirect(url);
    }
    
    // Redirect to admin/support if not already there
    if (!pathname.startsWith('/admin/support')) {
      url.pathname = '/admin/support';
      console.log('[Middleware] Redirecting platform_staff to /admin/support');
      return NextResponse.redirect(url);
    }
    
    return response;
  }

  // ===== 3️⃣ CLIENT ADMIN ROLE (workspace_id != NULL and != PLATFORM_WORKSPACE_ID) =====
  // Route: /dashboard only
  if (role === 'admin') {
    console.log('[Middleware] Processing client_admin access for workspace:', workspaceId);
    
    // Client admin MUST have a workspace_id
    if (!workspaceId || workspaceId === PLATFORM_WORKSPACE_ID) {
      console.error('[Middleware] Client admin has invalid workspace_id:', workspaceId);
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // Block admin from accessing admin or employee routes
    if (pathname === '/admin' || pathname.startsWith('/admin/') || 
        pathname === '/employees' || pathname.startsWith('/employees/')) {
      console.warn('[Middleware] Client admin attempted to access protected route:', pathname, '- redirecting to /dashboard');
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    
    // Redirect to dashboard if not already there
    if (!pathname.startsWith('/dashboard')) {
      url.pathname = '/dashboard';
      console.log('[Middleware] Redirecting client_admin to /dashboard');
      return NextResponse.redirect(url);
    }
    
    return response;
  }

  // ===== 4️⃣ EMPLOYEE ROLE =====
  // Route: /employees/dashboard only
  // Employees are client business staff scoped to exactly ONE workspace
  if (role === 'employee') {
    console.log('[Middleware] Processing employee access for workspace:', workspaceId);
    
    // ===== CRITICAL: Employees MUST have a workspace_id =====
    // This ensures employee scoping is enforced - each employee belongs to EXACTLY ONE workspace
    if (!workspaceId) {
      console.error('[Middleware] INVALID STATE: Employee without workspace_id, redirecting to /unauthorized');
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // ===== BLOCK: Employees cannot access admin or client dashboards =====
    // - /admin is for super_admin only (platform owner)
    // - /admin/support is for platform_staff only (Retail Assist internal staff)
    // - /dashboard is for client admin only (business owner)
    // - /employees/dashboard is the ONLY route for employees (client business staff)
    if (pathname === '/admin' || pathname.startsWith('/admin/') || 
        pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      console.warn('[Middleware] Employee attempted to access protected route:', pathname, '- redirecting to /employees/dashboard');
      url.pathname = '/employees/dashboard';
      return NextResponse.redirect(url);
    }
    
    // ===== ROUTE: Redirect to employee dashboard if not already there =====
    // After login or session check, employees must go to their dashboard
    if (!pathname.startsWith('/employees/dashboard')) {
      url.pathname = '/employees/dashboard';
      console.log('[Middleware] Redirecting employee to /employees/dashboard');
      return NextResponse.redirect(url);
    }
    
    // ===== WORKSPACE SCOPING =====
    // At this point, we know:
    // - User is employee
    // - User has exactly one workspace_id
    // - User is accessing /employees/dashboard/*
    // The /employees/dashboard/* endpoints MUST verify the user's workspace_id
    // matches the workspace they're trying to access (via query params or route)
    // This is enforced at the API layer, not middleware
    
    return response;
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

