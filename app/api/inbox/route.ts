import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listInboxConversations } from '@/lib/supabase/queries'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const workspaceId = url.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: userData } = await supabase.auth.getUser()
    const authUser = (userData as any)?.user
    if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Validate membership server-side inside the helper (it will throw if unauthorized)
    const convs = await listInboxConversations(supabase, workspaceId)
    return NextResponse.json({ data: convs })
  } catch (err: any) {
    console.error('Error in GET /api/inbox:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
