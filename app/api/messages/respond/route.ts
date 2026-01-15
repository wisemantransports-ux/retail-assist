import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { respondToMessage, escalateMessage, getEmployeeById } from '@/lib/supabase/queries'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messageId, response, escalate } = body

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: userData } = await supabase.auth.getUser()
    const authUser = (userData as any)?.user
    if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Get user role
    const { data: userProfile } = await supabase.from('users').select('role, id').eq('auth_uid', authUser.id).single()
    if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 })

    let employeeId: string | null = null
    if (userProfile.role === 'employee') {
      // Find employee record
      const { data: employee } = await supabase.from('employees').select('id').eq('user_id', userProfile.id).single()
      if (!employee) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })
      employeeId = employee.id
    }

    if (escalate) {
      if (!employeeId) return NextResponse.json({ error: 'Only employees can escalate' }, { status: 403 })
      // Find admin for escalation - for now, escalate to super_admin or admin
      const { data: admins } = await supabase.from('users').select('id').in('role', ['admin', 'super_admin']).limit(1)
      const adminId = admins?.[0]?.id || userProfile.id // fallback
      const { data, error } = await escalateMessage(messageId, adminId, employeeId)
      if (error) throw error
      return NextResponse.json({ data })
    } else {
      // Respond to message
      if (!response) {
        return NextResponse.json({ error: 'response is required when not escalating' }, { status: 400 })
      }
      const responderId = employeeId || userProfile.id // admin or employee
      const { data, error } = await respondToMessage(messageId, response, responderId)
      if (error) throw error
      return NextResponse.json({ data })
    }
  } catch (err: any) {
    console.error('Error in POST /api/messages/respond:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}