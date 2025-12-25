import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, business_name, phone, plan_type } = body;
    
    if (!email || !password || !business_name || !phone) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }
    
    const validPlans = ['starter', 'pro', 'enterprise'];
    const selectedPlan = validPlans.includes(plan_type) ? plan_type : 'starter';
    
    const user = await db.users.create({
      email,
      password,
      business_name,
      phone,
      plan_type: selectedPlan
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }
    
    await db.logs.add({
      user_id: user.id,
      level: 'info',
      message: `New user signup: ${business_name} (${email})`,
      meta: { plan_type: selectedPlan }
    });
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        business_name: user.business_name,
        subscription_status: user.subscription_status,
        plan_type: user.plan_type
      },
      message: 'Account created successfully. Please complete payment and wait for admin activation.'
    });
  } catch (error: any) {
    console.error('[Auth Signup] Error:', error.message);
    
    if (error.message === 'Email already exists') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
