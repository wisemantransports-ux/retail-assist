import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { markConversationMessagesAsRead } from '@/lib/supabase/queries'

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await params
    if (!conversationId) return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })

    const supabase = await createServerClient()
    const { data: userData } = await supabase.auth.getUser()
    const authUser = (userData as any)?.user
    if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    await markConversationMessagesAsRead(supabase, conversationId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Error in POST /api/inbox/[conversationId]/read:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}