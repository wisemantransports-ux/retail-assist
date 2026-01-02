import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sessionManager } from '@/lib/session'
import { env } from '@/lib/env'

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const sessionId = cookieHeader.split(';').find(c => c.trim().startsWith('session_id='))?.split('=')[1]

    if (sessionId) {
      await sessionManager.destroy(sessionId)
    }

    // Clear cookie using cookies() helper (explicit path + maxAge=0)
    cookies().set('session_id', '', { path: '/', maxAge: 0, httpOnly: true, secure: env.isProduction, sameSite: 'lax' })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Auth Logout] Error:', error?.message || error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
