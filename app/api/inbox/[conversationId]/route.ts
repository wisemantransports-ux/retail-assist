import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listConversationMessages } from '@/lib/supabase/queries'

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await params
    if (!conversationId) return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })

    const supabase = await createServerClient()
    const { data: userData } = await supabase.auth.getUser()
    const authUser = (userData as any)?.user
    if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const messages = await listConversationMessages(supabase, conversationId)
    return NextResponse.json({ data: messages })
  } catch (err: any) {
    console.error('Error in GET /api/inbox/[conversationId]:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
