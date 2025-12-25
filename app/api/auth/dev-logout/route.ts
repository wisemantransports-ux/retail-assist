import { NextResponse } from 'next/server'
import { sessionManager } from '@/lib/session'
import { env } from '@/lib/env'

export async function POST(req: Request) {
  // Dev logout only allowed in mock mode
  if (!env.useMockMode) {
    return NextResponse.json({ error: 'Dev auth not enabled' }, { status: 403 })
  }

  const cookie = req.headers.get('cookie') || ''
  const sessionId = cookie.split(';').find(c => c.trim().startsWith('session_id='))?.split('=')[1]
  if (sessionId) await sessionManager.destroy(sessionId)
  const res = NextResponse.json({ success: true })
  res.cookies.delete('session_id')
  return res
}
