import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const sessionId = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('session_id='))
      ?.split('=')[1];
    
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
    const sessionId = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('session_id='))
      ?.split('=')[1];
    
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
    const { token } = body;

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

    const { pages, selectedPageIds } = body;
    const pagesToConnect = selectedPageIds 
      ? tokenData.pages.filter((p: any) => selectedPageIds.includes(p.id))
      : tokenData.pages;

    const canAdd = await db.users.canAddPage(user.id);
    if (!canAdd.allowed) {
      return NextResponse.json({ error: canAdd.reason }, { status: 403 });
    }

    const limits = db.users.getPlanLimits(user.plan_type);
    const currentCount = await db.tokens.countByUserId(user.id);
    const maxAllowed = limits.maxPages === -1 ? Infinity : limits.maxPages;
    const allowedToAdd = maxAllowed - currentCount;

    if (pagesToConnect.length > allowedToAdd) {
      return NextResponse.json({ 
        error: `You can only add ${allowedToAdd} more page(s) on your ${limits.name} plan` 
      }, { status: 403 });
    }

    const savedPages = [];
    for (const page of pagesToConnect) {
      const existing = await db.tokens.findByPageId(page.id);
      if (existing) {
        await db.tokens.update(existing.id, {
          access_token: page.access_token,
          page_name: page.name
        });
        savedPages.push({ ...page, updated: true });
      } else {
        await db.tokens.create({
          user_id: user.id,
          platform: 'facebook',
          page_id: page.id,
          page_name: page.name,
          access_token: page.access_token
        });
        savedPages.push({ ...page, created: true });
      }
    }

    await db.logs.add({
      user_id: user.id,
      level: 'info',
      message: `Connected ${savedPages.length} Facebook page(s)`,
      meta: { pageIds: savedPages.map(p => p.id) }
    });

    console.log('[Meta Pages] Saved pages for user:', user.email, savedPages.length);

    return NextResponse.json({ 
      success: true,
      pages: savedPages.map(p => ({ id: p.id, name: p.name }))
    });
  } catch (error: any) {
    console.error('[Meta Pages] Error saving pages:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
