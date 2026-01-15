import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    // Supabase sign out
    const supabase = createServerClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.warn('[LOGOUT] Supabase signOut error:', error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Auth Logout] Error:', error?.message || error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
