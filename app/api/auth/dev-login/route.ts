import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { sessionManager } from '@/lib/session'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { cookies } from 'next/headers'

const SESSION_TTL_HOURS = 24 * 30
const SESSION_TTL_SECONDS = SESSION_TTL_HOURS * 3600

export async function POST(req: Request) {
  // Dev login only available when mock mode is enabled
  if (!env.useMockMode) {
    return NextResponse.json({ error: 'Dev auth not enabled' }, { status: 403 })
  }

  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 })

  const user = await db.users.authenticate(email, password)
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  const session = await sessionManager.create(user.id)
  const maxAge = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000))
  const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, role: user.role } })
  const cookieStore = await cookies()
  cookieStore.set('session_id', session.id, { path: '/', httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge })
  return res
}
