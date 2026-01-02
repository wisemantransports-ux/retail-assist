import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

export async function POST() {
  const cookieStore = cookies()

  // Clear session cookie safely
  cookieStore.set('session_id', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
  })

  return NextResponse.json({ success: true })
}