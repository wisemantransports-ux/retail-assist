import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { resolveUserId, ensureInternalUser } from '@/lib/supabase/queries'

// Use mock mode to avoid calling Supabase in CI or while testing.
// To go live, set NEXT_PUBLIC_USE_MOCK_SUPABASE=false and configure SUPABASE_* env vars.
const useDev = env.useMockMode

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Production (Supabase)
    const res = NextResponse.json({}) // placeholder for cookie setting
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

    // Ensure there is a deterministic internal users row for this auth UID
    const ensured = await ensureInternalUser(data.user.id)
    if (!ensured || !ensured.id) {
      console.error('[LOGIN] Failed to ensure internal user for auth UID:', data.user.id)
      return NextResponse.json({ error: 'User profile creation failed' }, { status: 500 })
    }
    const internalUserId = ensured.id

    // Fetch user role and workspace from RPC
    const { data: userAccess, error: rpcError } = await supabase.rpc('rpc_get_user_access')
    if (rpcError) {
      console.error('[LOGIN] RPC error:', rpcError)
      return NextResponse.json({ error: 'Role resolution failed' }, { status: 500 })
    }
    const accessRecord = userAccess?.[0]
    const role = accessRecord?.role || 'user'
    const workspaceId = accessRecord?.workspace_id || null

    console.log('[LOGIN] Resolved role:', role)
    console.log('[LOGIN] Workspace ID:', workspaceId)

    // Create final response with data
    const finalRes = NextResponse.json({ success: true, user: { id: internalUserId, email: data.user.email, role }, workspaceId })

    // Copy Supabase cookies from placeholder res to finalRes
    for (const cookie of res.cookies.getAll()) {
      finalRes.cookies.set(cookie.name, cookie.value, cookie)
    }

    return finalRes
  } catch (err) {
    console.error('[LOGIN_ERROR]', err)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}