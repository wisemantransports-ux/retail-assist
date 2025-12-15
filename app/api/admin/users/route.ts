import { NextResponse } from 'next/server';
import { replitDb, PLAN_LIMITS } from '@/lib/replit-db';
import { sessionManager } from '@/lib/replit-db/session';

async function verifyAdmin(request: Request) {
  const sessionId = request.headers.get('cookie')?.split(';')
    .find(c => c.trim().startsWith('session_id='))
    ?.split('=')[1];
  
  if (!sessionId) return null;
  
  const session = sessionManager.validate(sessionId);
  if (!session) return null;
  
  const user = await replitDb.users.findById(session.user_id);
  if (!user || user.role !== 'admin') return null;
  
  return user;
}

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await replitDb.users.getAll();
    
    const filteredUsers = users
      .filter(u => u.role !== 'admin')
      .map(u => ({
        id: u.id,
        email: u.email,
        business_name: u.business_name,
        phone: u.phone,
        plan_type: u.plan_type,
        plan_name: PLAN_LIMITS[u.plan_type]?.name || u.plan_type,
        plan_price: PLAN_LIMITS[u.plan_type]?.price || 0,
        payment_status: u.payment_status || 'unpaid',
        subscription_status: u.subscription_status,
        billing_start_date: u.billing_start_date,
        billing_end_date: u.billing_end_date,
        paypal_subscription_id: u.paypal_subscription_id,
        role: u.role,
        created_at: u.created_at
      }));

    const stats = {
      total: filteredUsers.length,
      pending: filteredUsers.filter(u => u.subscription_status === 'pending').length,
      awaiting_approval: filteredUsers.filter(u => u.subscription_status === 'awaiting_approval').length,
      active: filteredUsers.filter(u => u.subscription_status === 'active').length,
      suspended: filteredUsers.filter(u => u.subscription_status === 'suspended').length
    };

    return NextResponse.json({ users: filteredUsers, stats });
  } catch (error: any) {
    console.error('[Admin Users] Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, subscription_status, plan_type, paypal_subscription_id, billing_end_date } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const updateData: any = {};
    
    if (subscription_status && ['pending', 'awaiting_approval', 'active', 'suspended'].includes(subscription_status)) {
      updateData.subscription_status = subscription_status;
      if (subscription_status === 'active') {
        const now = new Date();
        updateData.billing_start_date = now.toISOString();
        updateData.activated_at = now.toISOString();
        updateData.payment_status = 'paid';
        if (!billing_end_date) {
          const endDate = new Date(now);
          endDate.setMonth(endDate.getMonth() + 1);
          updateData.billing_end_date = endDate.toISOString();
        }
      }
    }
    
    if (plan_type && ['starter', 'pro', 'enterprise'].includes(plan_type)) {
      updateData.plan_type = plan_type;
    }

    if (paypal_subscription_id !== undefined) {
      updateData.paypal_subscription_id = paypal_subscription_id;
    }

    if (billing_end_date) {
      updateData.billing_end_date = billing_end_date;
    }

    const updated = await replitDb.users.update(userId, updateData);
    
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await replitDb.logs.add({
      user_id: admin.id,
      level: 'info',
      message: `Admin updated user ${userId}`,
      meta: updateData
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('[Admin Users] Error:', error.message);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const deleted = await replitDb.users.delete(userId);
    
    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await replitDb.logs.add({
      user_id: admin.id,
      level: 'warn',
      message: `Admin deleted user ${userId}`
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin Users] Error:', error.message);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
