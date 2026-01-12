import { NextResponse } from 'next/server';
import { db, PLAN_LIMITS } from '@/lib/db';
import { ensureInternalUser } from '@/lib/supabase/queries';
import { sessionManager } from '@/lib/session';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

// Minimal file-backed logger (temporary, reversible)
function debugLog(msg: string) {
    try {
      // write into workspace so we can read it from the agent
      // keep entries short and never write cookie values
      const line = `${new Date().toISOString()} ${msg}\n`;
      require('fs').appendFileSync('/workspaces/retail-assist/tmp/auth-me-debug.log', line);
    } catch (_) {}
}

export async function GET(request: Request) {
  try {
    // Log presence of Cookie header (only presence, never values)
    const cookieHeaderPresent = !!request.headers.get('cookie');
    console.info('[Auth Me] Cookie header present:', cookieHeaderPresent ? 'YES' : 'NO');
    debugLog(`[Auth Me] Cookie header present: ${cookieHeaderPresent ? 'YES' : 'NO'}`);

    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    console.info('[Auth Me] session_id cookie present:', sessionId ? 'YES' : 'NO');
    debugLog(`[Auth Me] session_id cookie present: ${sessionId ? 'YES' : 'NO'}`);

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const session = await sessionManager.validate(sessionId);
    console.info('[Auth Me] session lookup:', session ? 'FOUND' : 'NOT_FOUND');
    debugLog(`[Auth Me] session lookup: ${session ? 'FOUND' : 'NOT_FOUND'}`);
    if (!session) {
      const response = NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
      console.info('[Auth Me] Clearing expired session_id cookie');
      debugLog('[Auth Me] Clearing expired session_id cookie');
      // Clear cookie using same path
      cookieStore.set('session_id', '', { path: '/', maxAge: 0, httpOnly: true, secure: env.isProduction, sameSite: 'lax' });
      return response;
    }
    
    // session.user_id should be the internal user ID (or auth UID if FK is still pointing to auth.users)
    // Try to look up by internal ID first, then fall back to auth_uid lookup
    console.info('[Auth Me] session.user_id:', session.user_id);
    debugLog(`[Auth Me] session.user_id: ${session.user_id}`);
    
    let user = await db.users.findById(session.user_id);
    console.info('[Auth Me] user lookup by ID:', user ? 'FOUND' : 'NOT_FOUND');
    debugLog(`[Auth Me] user lookup by ID: ${user ? 'FOUND' : 'NOT_FOUND'}`);
    
    if (!user) {
      // Maybe it's an auth UID, try that
      user = await db.users.findByAuthUid(session.user_id);
      console.info('[Auth Me] user lookup by auth_uid:', user ? 'FOUND' : 'NOT_FOUND');
      debugLog(`[Auth Me] user lookup by auth_uid: ${user ? 'FOUND' : 'NOT_FOUND'}`);
    }
    
    if (!user) {
      // Attempt to create/resolve internal user deterministically
      try {
        console.info('[Auth Me] attempting ensureInternalUser for', session.user_id);
        debugLog(`[Auth Me] attempting ensureInternalUser for ${session.user_id}`);
        const ensured = await ensureInternalUser(session.user_id);
        if (ensured && ensured.id) {
          user = await db.users.findById(ensured.id);
          console.info('[Auth Me] user lookup after ensureInternalUser:', user ? 'FOUND' : 'NOT_FOUND');
          debugLog(`[Auth Me] user lookup after ensureInternalUser: ${user ? 'FOUND' : 'NOT_FOUND'}`);
        }
      } catch (e: any) {
        console.error('[Auth Me] ensureInternalUser failed:', e?.message || e);
        debugLog(`[Auth Me] ensureInternalUser failed: ${e?.message}`);
      }

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }
    
    const planLimits = PLAN_LIMITS[user.plan_type] || PLAN_LIMITS['starter'];
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        phone: user.phone,
        payment_status: user.payment_status || 'unpaid',
        subscription_status: user.subscription_status,
        plan_type: user.plan_type || 'starter',
        plan_name: planLimits?.name || 'Starter',
        plan_limits: planLimits,
        billing_end_date: user.billing_end_date,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('[Auth Me] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
