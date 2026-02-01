import { NextResponse, NextRequest } from 'next/server'
import { createAuthSupabaseClient, applyCookies } from '@/lib/supabase/auth-server'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { ensureInternalUser } from '@/lib/supabase/queries'
import { sessionManager } from '@/lib/session'
import { ensureWorkspaceForUser } from '@/lib/supabase/ensureWorkspaceForUser';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    console.log('[LOGIN] Starting login flow for:', email)

    // Create Supabase client with proper session cookie handling
    // This reads cookies from request and will set them in the response
    const { supabase, response } = createAuthSupabaseClient(request)
    
    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      console.error('[LOGIN] Supabase signIn error:', { 
        message: error?.message, 
        status: (error as any)?.status 
      })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    console.log('[LOGIN] ✓ Supabase auth successful for user:', data.user.id)

    // Use admin client for database checks
    const adminClient = createAdminSupabaseClient()
    
    // ===== CRITICAL: CHECK EMPLOYEES FIRST =====
    // If user is an employee, return early to skip admin logic
    const { data: employeeCheck } = await adminClient
      .from('employees')
      .select('id, workspace_id, invited_by_role')
      .eq('auth_uid', data.user.id)
      .maybeSingle()
    
    if (employeeCheck) {
      console.log('[LOGIN] ✓ Employee detected - role: employee')
      
      // Create session for employee
      let sessionId: string
      try {
        const session = await sessionManager.create(data.user.id)
        sessionId = session.id
        console.log('[LOGIN] Created employee session:', sessionId)
      } catch (sessionErr: any) {
        console.error('[LOGIN] Employee session creation failed:', sessionErr.message)
        return NextResponse.json({ 
          error: 'Session creation failed',
          message: sessionErr.message 
        }, { status: 500 })
      }

      // Create final response with employee data
      const finalResponse = NextResponse.json(
        { 
          success: true, 
          user: { 
            id: data.user.id, 
            email: data.user.email, 
            role: 'employee'
          }, 
          workspaceId: employeeCheck.workspace_id
        },
        { status: 200 }
      )

      // Merge cookies from auth response (which has Supabase session cookies)
      mergeCookies(response, finalResponse)

      // Set custom session_id cookie
      finalResponse.cookies.set('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/'
      })

      console.log('[LOGIN] ✓ Employee login complete with cookies')
      return finalResponse
    }

    // ===== ADMIN FLOW (NOT AN EMPLOYEE) =====
    console.log('[LOGIN] Proceeding with admin flow')

    // Ensure there is an internal users row for this auth UID
    let internalUserId: string
    try {
      console.log('[LOGIN] Ensuring internal user exists for auth UID:', data.user.id)
      const ensured = await ensureInternalUser(data.user.id)
      
      if (!ensured || !ensured.id) {
        console.error('[LOGIN] ensureInternalUser returned no id')
        return NextResponse.json({ error: 'User profile not found - please accept an invite first' }, { status: 403 })
      }
      
      internalUserId = ensured.id
      console.log('[LOGIN] ✓ Internal user exists:', internalUserId)
    } catch (ensureErr: any) {
      const errMessage = ensureErr?.message || 'Unknown error'
      
      if (errMessage.includes('employee')) {
        console.error('[LOGIN] Employee error (should not reach here):', errMessage)
        return NextResponse.json({ error: 'Authentication error - please try again' }, { status: 500 })
      }
      
      if (errMessage.includes('role is missing')) {
        console.error('[LOGIN] User role missing:', errMessage)
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
    let role: string | null = null
    let workspaceId: string | null = null
    
    // 1) Check if user has super_admin role
    const { data: superAdminCheck } = await adminClient
      .from('users')
      .select('id, role')
      .eq('id', internalUserId)
      .eq('role', 'super_admin')
      .maybeSingle()
    
    if (superAdminCheck) {
      role = 'super_admin'
      workspaceId = null
      console.log('[LOGIN] ✓ Resolved role: super_admin')
    } else {
      // 2) Check if user has client_admin role
      const { data: clientAdminCheck } = await adminClient
        .from('users')
        .select('id, role')
        .eq('id', internalUserId)
        .eq('role', 'client_admin')
        .maybeSingle()
      
      if (clientAdminCheck) {
        role = 'admin'
        
        // Find workspace_id from workspace_members
        const { data: membershipCheck } = await adminClient
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', internalUserId)
          .maybeSingle()
        
        if (membershipCheck?.workspace_id) {
          workspaceId = membershipCheck.workspace_id
          console.log('[LOGIN] ✓ Resolved role: admin with workspace:', workspaceId)
        } else {
          console.log('[LOGIN] ✓ Resolved role: admin but no workspace yet')
        }
      }
    }

    // Role must be resolved
    if (!role) {
      console.error('[LOGIN] ✗ No role resolved for user:', data.user.id)
      return NextResponse.json({ 
        error: 'User role not found - onboarding incomplete. Please contact support.' 
      }, { status: 403 })
    }

    // ===== CLIENT ADMIN ONBOARDING COMPLETION =====
    // For client_admin without workspace: create workspace
    if (role === 'admin' && !workspaceId) {
      console.log('[LOGIN] Client admin without workspace - initiating workspace creation')
      
      try {
        const result = await ensureWorkspaceForUser(data.user.id)
        
        if (result.error) {
          console.error('[LOGIN] Workspace creation failed:', result.error)
          return NextResponse.json({ 
            error: 'Failed to create workspace: ' + result.error 
          }, { status: 500 })
        }
        
        workspaceId = result.workspaceId
        console.log('[LOGIN] ✓ Workspace created/assigned:', workspaceId)
      } catch (err: any) {
        console.error('[LOGIN] Workspace provisioning error:', err.message)
        return NextResponse.json({ 
          error: 'Workspace provisioning failed' 
        }, { status: 500 })
      }
    }

    // Validate workspace_id is set for non-super_admin
    if (workspaceId === undefined && role !== 'super_admin') {
      console.error('[LOGIN] ✗ No workspace_id for role:', role)
      return NextResponse.json({ error: 'User workspace not assigned' }, { status: 403 })
    }

    console.log('[LOGIN] ✓ Role resolution complete:', { role, workspaceId })

    // Create custom session in database
    let sessionId: string
    try {
      const session = await sessionManager.create(data.user.id)
      sessionId = session.id
      console.log('[LOGIN] Created session:', sessionId)
    } catch (sessionErr: any) {
      console.error('[LOGIN] Session creation failed:', sessionErr.message)
      return NextResponse.json({ 
        error: 'Session creation failed',
        message: sessionErr.message 
      }, { status: 500 })
    }

    // Create final response with user data
    const finalResponse = NextResponse.json(
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

    // CRITICAL: Merge cookies from auth response
    // This ensures Supabase session cookies are included in the final response
    mergeCookies(response, finalResponse)

    // Set custom session_id cookie for application session management
    finalResponse.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })

    console.log('[LOGIN] ✓ Login complete - session established with cookies')
    return finalResponse

  } catch (err) {
    console.error('[LOGIN_ERROR]', err)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
