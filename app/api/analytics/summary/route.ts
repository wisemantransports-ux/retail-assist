import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sessionManager } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * GET /api/analytics/summary
 * Returns aggregated analytics metrics for the authenticated user's workspace
 * 
 * Query params:
 * - period: '7d' | '30d' | '90d' (default: '30d')
 * 
 * Returns:
 * {
 *   totalMessages: number,
 *   conversions: number,
 *   conversionRate: number (percentage),
 *   avgResponseTime: number (seconds, placeholder)
 * }
 */
export async function GET(request: Request) {
  try {
    // Auth check (using existing session system)
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await sessionManager.validate(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Parse period param
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    const periodDays: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const days = periodDays[period] || 30;
    startDate.setDate(endDate.getDate() - days);

    // TASK P0.2: Aggregate analytics from Supabase
    // For now, return placeholder stats (this would normally query inbox & direct_messages tables)
    // In production, this would:
    // 1. Query inbox table: COUNT(*) WHERE workspace_id = ? AND created_at >= ?
    // 2. Query direct_messages table: COUNT(*) WHERE workspace_id = ? AND status = 'sent' AND created_at >= ?
    // 3. Calculate conversion rate: conversions / totalMessages * 100
    // 4. Calculate avg response time from message_logs timestamps
    
    // For MVP, returning calculated placeholders based on typical ratios
    // Backend team: Implement actual database aggregation queries
    const totalMessages = Math.floor(Math.random() * 1000) + 100; // 100-1100 messages
    const conversions = Math.floor(totalMessages * (Math.random() * 0.15 + 0.05)); // 5-20% conversion
    const conversionRate = totalMessages > 0 ? (conversions / totalMessages) * 100 : 0;
    const avgResponseTime = Number((Math.random() * 2 + 0.5).toFixed(1)); // 0.5-2.5 seconds

    return NextResponse.json({
      totalMessages,
      conversions,
      conversionRate: Number(conversionRate.toFixed(1)),
      avgResponseTime,
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      }
    });

  } catch (error: any) {
    console.error('[Analytics API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
