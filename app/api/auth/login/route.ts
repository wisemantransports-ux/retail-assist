import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { resolveUserId, ensureInternalUser } from '@/lib/supabase/queries'
import { sessionManager } from '@/lib/session'
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace'
import { ensureWorkspaceForUser } from '@/lib/supabase/ensureWorkspaceForUser'

export async function POST(request: NextRequest) {
  try {
    // RUNTIME ASSERTION: Log Supabase URL
    console.log(
      '[RUNTIME SUPABASE URL]',
      process.env.NEXT_PUBLIC_SUPABASE_URL
    )

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

    // ===== CRITICAL: CHECK EMPLOYEES FIRST =====
    // If user is an employee, skip all admin logic and redirect directly
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const adminCheckClient = createAdminSupabaseClient()
    
    const { data: employeeDirectCheck } = await adminCheckClient
      .from('employees')
      .select('id, workspace_id, invited_by_role, auth_uid')
      .eq('auth_uid', data.user.id)
      .maybeSingle()
    
    if (employeeDirectCheck) {
      console.log('[LOGIN] ✓ Employee detected directly by auth_uid - skipping admin logic, role: employee')
      
      // Create session for employee
      let sessionId: string
      try {
        const session = await sessionManager.create(data.user.id)
        sessionId = session.id
        console.log('[LOGIN] Created employee session:', sessionId)
      } catch (sessionErr: any) {
        console.error('[LOGIN] Employee session creation failed:', sessionErr.message || sessionErr)
        return NextResponse.json({ 
          error: 'Session creation failed',
          message: sessionErr.message 
        }, { status: 500 })
      }

      // Return employee response - no admin rows should exist
      const finalRes = NextResponse.json(
        { 
          success: true, 
          user: { 
            id: employeeDirectCheck.id, 
            email: data.user.email, 
            role: 'employee'
          }, 
          workspaceId: employeeDirectCheck.workspace_id
        },
        { status: 200 }
      )

      // Copy all Supabase session cookies from the auth response
      const res = NextResponse.json({})
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
      console.log('[LOGIN] Employee session established with cookies:', sessionId)

      return finalRes
    }

    // ===== CRITICAL GUARD: NO EMPLOYEE SHOULD REACH HERE =====
    // Employee check above should have returned already
    // This is a safety check to prevent any employee from reaching admin flow
    console.log('[LOGIN] Proceeding with admin flow (employee already checked above)')

    // ===== ADMIN FLOW (NOT AN EMPLOYEE) =====
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
      
      // Check if it's an employee error (should have been caught above, but extra safety)
      if (errMessage.includes('employee')) {
        console.error('[LOGIN] Employee reached ensureInternalUser - this should not happen:', errMessage)
        return NextResponse.json({ error: 'Authentication error - please try again' }, { status: 500 })
      }
      
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

    // ===== AUTHORITATIVE ROLE RESOLUTION (RPC ONLY) =====
    // Use rpc_get_user_access() as the single source of truth for role and workspace
    // This ensures consistency with middleware and /api/auth/me
    
    const result = await supabase
      .rpc('rpc_get_user_access')
      .single()
    const accessData = result.data

    if (!accessData) {
      console.error('[LOGIN] Role resolution failed:', 'no access data')
      return NextResponse.json(
        { error: 'Unable to determine user role' },
        { status: 403 }
      )
    }

    const role = (accessData as any).role as string
    let workspaceId = (accessData as any).workspace_id as string | null
    const employeeScope = role === 'employee' ? (accessData as any).invited_by_role : null

    console.log('[LOGIN] ✓ Role resolved via RPC:', { role, workspaceId, employeeScope, auth_uid: data.user.id })

    // Role must be resolved
    if (!role) {
      console.error('[LOGIN] ✗ No role resolved for user:', data.user.id)
      return NextResponse.json({ 
        error: 'User role not found - onboarding incomplete. Please contact support.' 
      }, { status: 403 })
    }

    // ===== CLIENT ADMIN ONBOARDING COMPLETION =====
    // For client_admin role: Create workspace if missing, return workspaceId
    if (role === 'admin' && !workspaceId) {
      console.log('[LOGIN] Client admin without workspace detected - initiating onboarding completion');
      
      try {
        const result = await ensureWorkspaceForUser(data.user.id);
        
        if (result.error) {
          console.error('[LOGIN] Workspace creation failed:', result.error);
          return NextResponse.json({ 
            error: 'Failed to create workspace: ' + result.error 
          }, { status: 500 });
        }
        
        workspaceId = result.workspaceId;
        console.log('[LOGIN] ✓ Workspace created/assigned for client_admin:', workspaceId);
      } catch (err: any) {
        console.error('[LOGIN] Workspace provisioning error:', err.message);
        return NextResponse.json({ 
          error: 'Workspace provisioning failed' 
        }, { status: 500 });
      }
    }

    // workspace_id is optional only for super_admin
    if (workspaceId === undefined && role !== 'super_admin') {
      console.error('[LOGIN] ✗ No workspace_id for role:', role, 'user:', data.user.id)
      return NextResponse.json({ error: 'User workspace not assigned' }, { status: 403 })
    }

    console.log('[LOGIN] ✓ Role resolution complete:', { role, workspaceId, employeeScope })

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