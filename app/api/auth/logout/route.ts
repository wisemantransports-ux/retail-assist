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

    // Create response to properly capture Supabase logout cookies
    const res = NextResponse.json({ success: true })
    
    // Use createServerClient with request/response for proper session cookie handling
    // This ensures Supabase session is properly cleared on the client
    // @ts-ignore
    const supabase = createServerClient(request, res as any)
    
    // Call Supabase signOut to clear auth session
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.warn('[LOGOUT] Supabase signOut error:', error.message)
    }

    // Clear the custom session_id cookie
    res.cookies.delete('session_id')
    console.log('[LOGOUT] session_id cookie cleared')

    console.log('[LOGOUT] User signed out successfully')
    
    // Return response with cleared Supabase auth cookies
    // Supabase cookies are automatically cleared through the SSR client
    return res
  } catch (error: any) {
    console.error('[Auth Logout] Error:', error?.message || error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
