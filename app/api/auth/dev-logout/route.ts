import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = cookies()

  // Clear session cookie safely
  cookieStore.set('session_id', '', {
    path: '/',
    maxAge: 0,
  })

  return NextResponse.json({ success: true })
}