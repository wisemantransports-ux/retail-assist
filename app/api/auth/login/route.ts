import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sessionManager } from '@/lib/session'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { ensureWorkspaceForUser } from '@/lib/supabase/ensureWorkspaceForUser'
import { resolveUserId, ensureInternalUser } from '@/lib/supabase/queries'
import { cookies } from 'next/headers'

// Use mock mode to avoid calling Supabase in CI or while testing.
// To go live, set NEXT_PUBLIC_USE_MOCK_SUPABASE=false and configure SUPABASE_* env vars.
const useDev = env.useMockMode

// session TTL is determined by sessionManager.create -> use returned session.expires_at

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
      if (!user) {
        console.warn('[LOGIN] Dev auth failed for:', email)
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      const session = await sessionManager.create(user.id, 24 * 7)
      const maxAge = 7 * 24 * 60 * 60
      const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, role: user.role } })
      const cookieStore = await cookies()
      cookieStore.set('session_id', session.id, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge })
      return res
    }

    // Production (Supabase)
    const supabase = createServerClient()
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

    // Ensure user has a workspace (safe to call multiple times) — pass internal id
    const workspaceResult = await ensureWorkspaceForUser(internalUserId)
    if (workspaceResult.error) {
      console.warn('[LOGIN] Workspace provisioning warning:', workspaceResult.error)
      // Don't fail login if workspace provisioning fails - user can create/join later
    }

    // create our session record using the deterministic internal users.id
    const session = await sessionManager.create(internalUserId, 24 * 7)
    const maxAge = 7 * 24 * 60 * 60
    const res = NextResponse.json({ success: true, user: { id: internalUserId, email: data.user.email, role: (data.user as any).role || 'user' }, workspaceId: workspaceResult.workspaceId })
    const cookieStore = await cookies()
    cookieStore.set('session_id', session.id, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge })
    return res
  } catch (err) {
    console.error('[LOGIN_ERROR]', err)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}