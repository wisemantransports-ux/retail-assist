import { createServerClient } from '@supabase/ssr';
import { NextResponse, NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

  // Fetch user role from RPC
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

  // If RPC returns no role, redirect to login
  if (!role) {
    console.warn('[Middleware] No role found for user, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based redirect
  const url = request.nextUrl.clone();
  if (role === 'super_admin' && !url.pathname.startsWith('/admin')) {
    url.pathname = '/admin';
    console.log('[Middleware] Redirecting super_admin to:', url.pathname);
    return NextResponse.redirect(url);
  }
  // Admin role: distinguish between super admin (NULL workspace) and client admin
  if (role === 'admin') {
    if (workspaceId === null) {
      // Super admin without workspace - redirect to /admin
      if (!url.pathname.startsWith('/admin')) {
        url.pathname = '/admin';
        console.log('[Middleware] Redirecting super_admin (via admin role) to /admin');
        return NextResponse.redirect(url);
      }
    } else {
      // Client admin with workspace - redirect to /dashboard
      if (!url.pathname.startsWith('/dashboard')) {
        url.pathname = '/dashboard';
        console.log('[Middleware] Redirecting client_admin to /dashboard');
        return NextResponse.redirect(url);
      }
    }
  }
  if (role === 'employee' && !url.pathname.startsWith('/employees/dashboard')) {
    url.pathname = '/employees/dashboard';
    console.log('[Middleware] Redirecting employee to:', url.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

// Apply middleware to relevant routes
export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/employees/:path*'],
};

