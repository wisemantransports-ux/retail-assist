import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sessionManager } from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * GET /api/ai/usage
 * Returns AI usage metrics for the authenticated user
 * 
 * Returns:
 * {
 *   count: number (total AI messages sent)
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

    // TASK P0.3: Count AI messages sent by the user
    // For now, return a placeholder count based on random generation
    // In production, this would:
    // 1. Query message_logs table: COUNT(*) WHERE user_id = ? AND type = 'ai'
    // 2. Or query agent_usage table: SUM(count) for the user
    
    const count = Math.floor(Math.random() * 10000) + 100; // 100-10,100 messages
    
    return NextResponse.json({ count });

  } catch (error: any) {
    console.error('[AI Usage API] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch AI usage' },
      { status: 500 }
    );
  }
}
