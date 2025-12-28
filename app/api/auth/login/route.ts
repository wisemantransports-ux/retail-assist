import { NextResponse } from 'next/server'
import { createServerClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { sessionManager } from '@/lib/session'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { ensureWorkspaceForUser } from '@/lib/supabase/ensureWorkspaceForUser'

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

    // Dev fallback (local seed)
    if (useDev) {
      const user = await db.users.authenticate(email, password)
      if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

      const session = await sessionManager.create(user.id, 24 * 30)
      const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, role: user.role } })
      res.cookies.set('session_id', session.id, { path: '/', httpOnly: true })
      return res
    }

    // Production (Supabase)
    const supabase = createServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Ensure user has a workspace (safe to call multiple times)
    const workspaceResult = await ensureWorkspaceForUser()
    if (workspaceResult.error) {
      console.warn('[LOGIN] Workspace provisioning warning:', workspaceResult.error)
      // Don't fail login if workspace provisioning fails - user can create/join later
    }

    // create our session record (keeps behavior consistent with local dev)
    const session = await sessionManager.create(data.user.id, 24 * 30)
    const res = NextResponse.json({ success: true, user: { id: data.user.id, email: data.user.email, role: (data.user as any).role || 'user' }, workspaceId: workspaceResult.workspaceId })
    res.cookies.set('session_id', session.id, { path: '/', httpOnly: true })
    return res
  } catch (err) {
    console.error('[LOGIN_ERROR]', err)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}