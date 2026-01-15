import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getBrand, saveBrand } from '@/config/branding';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const brand = getBrand();
    return NextResponse.json(brand);
  } catch (error: any) {
    console.error('[Branding API] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = sessionCookie.value;
    const user = await db.users.findById(userId);
    
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const updated = saveBrand(body);
    
    return NextResponse.json({ brand: updated, success: true });
  } catch (error: any) {
    console.error('[Branding API] PUT error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
