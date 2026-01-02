import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sessionManager } from '@/lib/session'
import { env } from '@/lib/env'
import { createServerClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    // ✅ cookies() is async in Next 16
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('session_id')?.value

    if (sessionId) {
      await sessionManager.destroy(sessionId)
    }

    // Best-effort Supabase sign out (production only)
    if (!env.useMockMode) {
      try {
        const supabase = createServerClient()
        await supabase.auth.signOut()
      } catch (e: any) {
        console.warn('[LOGOUT] Supabase signOut failed (non-fatal):', e?.message || e)
      }
    }

    // ✅ Correct cookie deletion
    cookieStore.set('session_id', '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Auth Logout] Error:', error?.message || error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
