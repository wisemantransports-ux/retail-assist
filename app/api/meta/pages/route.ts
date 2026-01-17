import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await sessionManager.validate(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const tokens = await db.tokens.findByUserId(session.user_id);
    
    return NextResponse.json({ 
      pages: tokens.map(t => ({
        id: t.id,
        page_id: t.page_id,
        page_name: t.page_name,
        platform: t.platform,
        connected_at: t.created_at
      }))
    });
  } catch (error: any) {
    console.error('[Meta Pages] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await sessionManager.validate(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const user = await db.users.findById(session.user_id);
    if (!user || user.subscription_status !== 'active') {
      return NextResponse.json({ error: 'Subscription not active' }, { status: 403 });
    }

    const body = await request.json();
    const { token, platform, selectedPageIds } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
    }

    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    if (tokenData.userId !== session.user_id) {
      return NextResponse.json({ error: 'Token mismatch' }, { status: 403 });
    }

    if (Date.now() - tokenData.timestamp > 10 * 60 * 1000) {
      return NextResponse.json({ error: 'Token expired. Please reconnect.' }, { status: 400 });
    }

    // ===== DETERMINE PLATFORM =====
    const accountPlatform = platform === 'instagram' ? 'instagram' : 'facebook';
    const itemsToConnect = accountPlatform === 'instagram' ? (tokenData.accounts || []) : (tokenData.pages || []);

    const pagesToConnect = selectedPageIds 
      ? itemsToConnect.filter((p: any) => selectedPageIds.includes(p.id))
      : itemsToConnect;

    const limits = db.users.getPlanLimits(user.plan_type);

    // ===== PLAN-AWARE ACCOUNT CONNECTION RESTRICTIONS =====
    // Starter plan: Users can only connect ONE account total (Facebook OR Instagram)
    if (user.plan_type === 'starter') {
      const currentCount = await db.tokens.countByUserId(user.id);
      
      // If trying to select multiple accounts, reject immediately
      if (pagesToConnect.length > 1) {
        await db.logs.add({
          user_id: user.id,
          level: 'warn',
          message: `Starter plan violation: Attempted to connect ${pagesToConnect.length} ${accountPlatform} accounts`,
          meta: { 
            plan: 'starter',
            platform: accountPlatform,
            attemptedCount: pagesToConnect.length,
            reason: 'Starter plan allows only one account'
          }
        });
        return NextResponse.json({ 
          error: 'Starter plan allows only one account. Upgrade to connect another.' 
        }, { status: 403 });
      }

      // If user already has an account and is trying to add another, reject
      if (currentCount > 0 && pagesToConnect.length > 0) {
        await db.logs.add({
          user_id: user.id,
          level: 'warn',
          message: `Starter plan violation: Attempted to add ${accountPlatform} account when one already exists`,
          meta: { 
            plan: 'starter',
            platform: accountPlatform,
            existingCount: currentCount,
            attemptedCount: pagesToConnect.length,
            reason: 'Starter plan allows only one account total'
          }
        });
        return NextResponse.json({ 
          error: 'Starter plan allows only one account. Upgrade to connect another.' 
        }, { status: 403 });
      }
    }
    // ===== END PLAN-AWARE RESTRICTIONS =====

    const canAdd = await db.users.canAddPage(user.id);
    if (!canAdd.allowed) {
      return NextResponse.json({ error: canAdd.reason }, { status: 403 });
    }

    const currentCount = await db.tokens.countByUserId(user.id);
    const maxAllowed = limits.maxPages === -1 ? Infinity : limits.maxPages;
    const allowedToAdd = maxAllowed - currentCount;

    if (pagesToConnect.length > allowedToAdd) {
      return NextResponse.json({ 
        error: `You can only add ${allowedToAdd} more ${accountPlatform === 'instagram' ? 'Instagram account(s)' : 'page(s)'} on your ${limits.name} plan` 
      }, { status: 403 });
    }

    const savedPages = [];
    for (const page of pagesToConnect) {
      const existing = await db.tokens.findByPageId(page.id);
      if (existing) {
        await db.tokens.update(existing.id, {
          access_token: page.access_token,
          page_name: page.name || page.username || 'Unknown'
        });
        savedPages.push({ ...page, updated: true });
      } else {
        await db.tokens.create({
          user_id: user.id,
          platform: accountPlatform,
          page_id: page.id,
          page_name: page.name || page.username || 'Unknown',
          access_token: page.access_token
        });
        savedPages.push({ ...page, created: true });
      }
    }

    await db.logs.add({
      user_id: user.id,
      level: 'info',
      message: `Connected ${savedPages.length} ${accountPlatform === 'instagram' ? 'Instagram' : 'Facebook'} ${accountPlatform === 'instagram' ? 'account(s)' : 'page(s)'}`,
      meta: { pageIds: savedPages.map(p => p.id), platform: accountPlatform }
    });

    console.log('[Meta Pages] Saved pages for user:', user.email, savedPages.length, 'platform:', accountPlatform);

    return NextResponse.json({ 
      success: true,
      pages: savedPages.map(p => ({ id: p.id, name: p.name || p.username || 'Unknown' }))
    });
  } catch (error: any) {
    console.error('[Meta Pages] Error saving pages:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
