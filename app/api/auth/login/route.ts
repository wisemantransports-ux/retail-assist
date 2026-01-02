import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { sessionManager } from '@/lib/session'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { ensureWorkspaceForUser } from '@/lib/supabase/ensureWorkspaceForUser'

// Toggle mock mode
const useMock = env.useMockMode

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)

    if (!body?.email || !body?.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const { email, password } = body

    /* =========================
       MOCK / DEV MODE LOGIN
    ========================== */
    if (useMock) {
      const user = await db.users.authenticate(email, password)

      if (!user) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      const session = await sessionManager.create(user.id)
      const maxAge = Math.max(
        0,
        Math.floor(
          (new Date(session.expires_at).getTime() - Date.now()) / 1000
        )
      )

      const cookieStore = await cookies()
      cookieStore.set('session_id', session.id, {
        path: '/',
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'lax',
        maxAge,
      })

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      })
    }

    /* =========================
       SUPABASE PRODUCTION LOGIN
    ========================== */
    const supabase = createServerClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data?.user) {
      console.error('[LOGIN] Supabase error:', {
        message: error?.message,
        status: (error as any)?.status,
      })

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    /* =========================
       WORKSPACE (NON-BLOCKING)
    ========================== */
    let workspaceId: string | null = null
    try {
      const result = await ensureWorkspaceForUser()
      workspaceId = result?.workspaceId ?? null
    } catch (e) {
      console.warn('[LOGIN] Workspace creation failed (non-fatal)')
    }

    /* =========================
       APP SESSION (COOKIE)
    ========================== */
    const session = await sessionManager.create(data.user.id)
    const maxAge = Math.max(
      0,
      Math.floor(
        (new Date(session.expires_at).getTime() - Date.now()) / 1000
      )
    )

    const cookieStore = await cookies()
    cookieStore.set('session_id', session.id, {
      path: '/',
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      maxAge,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: (data.user as any)?.role ?? 'user',
      },
      workspaceId,
    })
  } catch (err: any) {
    console.error('[LOGIN_FATAL]', err?.message || err)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
