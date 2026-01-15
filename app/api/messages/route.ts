import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listMessagesForEmployee, listMessagesForBusiness } from '@/lib/supabase/queries'
import type { EmployeeMessageStatus, MessageChannel } from '@/lib/types/database'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const businessId = url.searchParams.get('businessId')
    const employeeId = url.searchParams.get('employeeId')
    const statusRaw = url.searchParams.getAll('status')
    const channelRaw = url.searchParams.getAll('channel')
    const status = statusRaw.filter(s => ['new', 'in_progress', 'escalated', 'completed'].includes(s)) as EmployeeMessageStatus[]
    const channel = channelRaw.filter(c => ['facebook', 'instagram', 'whatsapp', 'website_chat'].includes(c)) as MessageChannel[]
    const search = url.searchParams.get('search') || undefined
    const sortBy = url.searchParams.get('sortBy') as 'created_at' | 'updated_at' | 'priority' | undefined
    const sortOrder = url.searchParams.get('sortOrder') as 'asc' | 'desc' | undefined
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined

    const supabase = await createServerClient()
    const { data: userData } = await supabase.auth.getUser()
    const authUser = (userData as any)?.user
    if (!authUser) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    let messages

    if (employeeId) {
      // Employee view - only their messages
      const { data, error } = await listMessagesForEmployee(employeeId, {
        status: status.length > 0 ? status : undefined,
        channel: channel.length > 0 ? channel : undefined,
        search,
        sortBy,
        sortOrder,
        limit,
        offset
      })
      if (error) throw error
      messages = data
    } else {
      // Admin/Super admin view - all messages for business or retail assist
      const businessSortBy = sortBy === 'priority' ? 'created_at' : sortBy
      const { data, error } = await listMessagesForBusiness(businessId || undefined, {
        status: status.length > 0 ? status : undefined,
        channel: channel.length > 0 ? channel : undefined,
        search,
        sortBy: businessSortBy,
        sortOrder,
        limit,
        offset
      })
      if (error) throw error
      messages = data
    }

    return NextResponse.json({ data: messages })
  } catch (err: any) {
    console.error('Error in GET /api/messages:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}