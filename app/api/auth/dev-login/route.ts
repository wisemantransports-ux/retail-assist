import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { sessionManager } from '@/lib/session'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

export async function POST(req: Request) {
  // Dev login only available when mock mode is enabled
  if (!env.useMockMode) {
    return NextResponse.json({ error: 'Dev auth not enabled' }, { status: 403 })
  }

  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 })

  const user = await db.users.authenticate(email, password)
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  const session = await sessionManager.create(user.id, 24 * 30)
  const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, role: user.role } })
  res.cookies.set('session_id', session.id, { path: '/', httpOnly: true })
  return res
}
