import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateAIResponse, getMessageById } from '@/lib/supabase/queries'
import { generateAgentResponse } from '@/lib/openai/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messageId } = body

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: userData } = await supabase.auth.getUser()
    const authUser = (userData as any)?.user
    if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Get the message
    const { data: message } = await getMessageById(messageId)
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Generate AI response
    const aiResponse = await generateAgentResponse(
      'You are a helpful customer service assistant. Provide a professional, friendly response to customer inquiries.',
      message.content,
      { temperature: 0.7, max_tokens: 500, model: 'gpt-4o-mini' }
    )

    const confidence = 0.85 // Mock confidence score

    // Save AI response
    const { data, error } = await generateAIResponse(messageId, aiResponse, confidence)
    if (error) throw error

    return NextResponse.json({ data: { response: aiResponse, confidence } })
  } catch (err: any) {
    console.error('Error in POST /api/messages/ai:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}