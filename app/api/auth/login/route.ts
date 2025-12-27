import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import ensureWorkspaceForUser from '@/lib/supabase/ensureWorkspaceForUser'
import { sessionManager } from '@/lib/session'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

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

    const authUid = data.user.id

    // Ensure user record exists in public.users table
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUid)
      .single()

    if (!existingUser && !checkError) {
      // User record doesn't exist, create it
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUid,
          email: data.user.email,
        })
      
      if (insertError) {
        console.error('[LOGIN] Failed to create user record:', insertError)
        return NextResponse.json(
          { error: 'Failed to initialize user account' },
          { status: 500 }
        )
      }
    }

    // create our session record (keeps behavior consistent with local dev)
    const session = await sessionManager.create(authUid, 24 * 30)
    // Ensure workspace for first-time users (production only)
    if (!useDev) {
      try {
        await ensureWorkspaceForUser(authUid, data.user.email as string)
      } catch (e) {
        console.error('[LOGIN] ensureWorkspaceForUser failed:', e)
      }
    }
    const res = NextResponse.json({ success: true, user: { id: authUid, email: data.user.email, role: (data.user as any).role || 'user' } })
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