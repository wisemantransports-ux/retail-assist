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

  // Get current session
  const { data: { session } } = await supabase.auth.getSession();

  // If no session, redirect to login
  if (!session) return NextResponse.redirect(new URL('/login', request.url));

  // Fetch user role from RPC
  const { data: userAccess } = await supabase.rpc('rpc_get_user_access');
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
  if (role === 'admin' && !url.pathname.startsWith('/dashboard')) {
    url.pathname = '/dashboard';
    console.log('[Middleware] Redirecting admin to:', url.pathname);
    return NextResponse.redirect(url);
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
