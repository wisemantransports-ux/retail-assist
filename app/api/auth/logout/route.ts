import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sessionManager } from '@/lib/session'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Clear custom session if it exists
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('session_id')?.value
    if (sessionId) {
      try {
        await sessionManager.destroy(sessionId)
        console.log('[LOGOUT] Custom session destroyed:', sessionId)
      } catch (sessionErr: any) {
        console.warn('[LOGOUT] Failed to destroy session:', sessionErr.message)
      }
    }

    // Create response to hold Supabase cookies
    const res = NextResponse.json({ success: true })
    
    // Create Supabase client with cookie handling to ensure we clear auth cookies properly
    // @ts-ignore
    const supabase = createServerClient(request, res as any)
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.warn('[LOGOUT] Supabase signOut error:', error.message)
    }

    // Clear the session_id cookie
    res.cookies.delete('session_id')
    console.log('[LOGOUT] session_id cookie cleared')

    console.log('[LOGOUT] User signed out successfully')
    
    // Return response with cleared Supabase cookies
    return res
  } catch (error: any) {
    console.error('[Auth Logout] Error:', error?.message || error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
