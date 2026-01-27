import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { resolveUserId, ensureInternalUser } from '@/lib/supabase/queries'
import { sessionManager } from '@/lib/session'
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Initialize response to capture cookies
    const res = NextResponse.json({})
    
    // Create Supabase client with request/response for cookie handling
    // This uses the SSR client which automatically manages session cookies
    // @ts-ignore
    const supabase = createServerClient(request, res as any)
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      try {
        console.error('[LOGIN] Supabase signIn error:', { message: error?.message, status: (error as any)?.status, data: data ? { user: !!data.user } : null })
      } catch (logErr) {
        console.error('[LOGIN] Supabase signIn error (failed to log details)', logErr)
      }

      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    console.log('[LOGIN] Auth signIn successful, user ID:', data.user.id, 'email:', data.user.email)

    console.log('[LOGIN] Auth signIn successful, user ID:', data.user.id, 'email:', data.user.email)

    // Ensure there is a deterministic internal users row for this auth UID
    let internalUserId: string
    let internalUser: any
    try {
      console.log('[LOGIN] Calling ensureInternalUser with auth UID:', data.user.id)
      const ensured = await ensureInternalUser(data.user.id)
      console.log('[LOGIN] ensureInternalUser returned:', ensured)
      if (!ensured || !ensured.id) {
        console.error('[LOGIN] ensureInternalUser returned no id for auth UID:', data.user.id)
        return NextResponse.json({ error: 'User profile not found - please accept an invite first' }, { status: 403 })
      }
      internalUserId = ensured.id
    } catch (ensureErr: any) {
      // v1: If user doesn't exist after invite, login fails (no auto-creation)
      const errMessage = ensureErr?.message || 'Unknown error'
      
      // Check if it's a role missing error
      if (errMessage.includes('role is missing')) {
        console.error('[LOGIN] User role missing:', { auth_uid: data.user.id, error: errMessage })
        return NextResponse.json({ 
          error: 'User role not configured - onboarding incomplete. Please contact support.' 
        }, { status: 403 })
      }
      
      console.error('[LOGIN] ensureInternalUser error:', errMessage)
      return NextResponse.json({ 
        error: 'User profile not found - please accept an invite first' 
      }, { status: 403 })
    }

    // ===== ROLE-BASED ACCESS RESOLUTION =====
    // Fetch user role and workspace - check super_admin role first
    // Use admin client to bypass RLS policies
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const adminClient = createAdminSupabaseClient()
    
    let role: string | null = null
    let workspaceId: string | null = null
    
    // 1) Check if user has super_admin role in users table
    const { data: superAdminCheck } = await adminClient
      .from('users')
      .select('id, role')
      .eq('id', internalUserId)
      .eq('role', 'super_admin')
      .maybeSingle()
    
    if (superAdminCheck) {
      role = 'super_admin'
      workspaceId = null
      console.log('[LOGIN] Resolved role: super_admin (from users table)')
    } else {
      // 2) Check admin_access table
      const { data: adminAccessCheck } = await adminClient
        .from('admin_access')
        .select('user_id, workspace_id, role')
        .eq('user_id', internalUserId)
        .maybeSingle()
      
      if (adminAccessCheck) {
        role = adminAccessCheck.role || 'admin'
        workspaceId = adminAccessCheck.workspace_id
        console.log('[LOGIN] Resolved role:', role, 'workspace:', workspaceId)
      } else {
        // 3) Check employees table
        const { data: employeeCheck } = await adminClient
          .from('employees')
          .select('user_id, workspace_id')
          .eq('user_id', internalUserId)
          .maybeSingle()
        
        if (employeeCheck) {
          role = 'employee'
          workspaceId = employeeCheck.workspace_id
          console.log('[LOGIN] Resolved role: employee, workspace:', workspaceId)
        }
      }
    }

    // v1: Role and workspace_id are required
    if (!role) {
      console.error('[LOGIN] No role resolved for user:', data.user.id)
      return NextResponse.json({ 
        error: 'User role not found - onboarding incomplete. Please contact support.' 
      }, { status: 403 })
    }

    // workspace_id is optional only for super_admin and platform_staff
    if (workspaceId === undefined && role !== 'super_admin' && role !== 'platform_staff') {
      console.error('[LOGIN] No workspace_id for role:', role, 'user:', data.user.id)
      return NextResponse.json({ error: 'User workspace not assigned' }, { status: 403 })
    }

    console.log('[LOGIN] Resolved role:', role)
    console.log('[LOGIN] Workspace ID:', workspaceId)

    // Create custom session in database
    let sessionId: string
    try {
      // Pass the auth user ID to sessionManager, it will handle conversion to internal ID if needed
      const session = await sessionManager.create(data.user.id)
      sessionId = session.id
      console.log('[LOGIN] Created session:', sessionId)
    } catch (sessionErr: any) {
      console.error('[LOGIN] Session creation failed:', sessionErr.message || sessionErr)
      return NextResponse.json({ 
        error: 'Session creation failed',
        message: sessionErr.message 
      }, { status: 500 })
    }

    // ===== RETURN ROLE AND WORKSPACE_ID FOR CLIENT-SIDE ROUTING =====
    // Client will use role to determine post-login redirect:
    //   - super_admin → /admin
    //   - platform_staff → /admin/support
    //   - admin → /dashboard
    //   - employee → /employees/dashboard
    
    // Create final response with user data
    const finalRes = NextResponse.json(
      { 
        success: true, 
        user: { 
          id: internalUserId, 
          email: data.user.email, 
          role 
        }, 
        workspaceId 
      },
      { status: 200 }
    )

    // Copy all Supabase session cookies from the auth response
    // The Supabase client uses the response object to set auth cookies automatically
    res.cookies.getAll().forEach((cookie) => {
      finalRes.cookies.set(cookie.name, cookie.value, cookie)
    })

    // Set the custom session_id cookie for application session management
    const cookieStore = await cookies()
    const maxAge = 7 * 24 * 60 * 60 // 7 days
    
    finalRes.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAge,
      path: '/'
    })
    console.log('[LOGIN] Session established with cookies:', sessionId)

    return finalRes
  } catch (err) {
    console.error('[LOGIN_ERROR]', err)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}