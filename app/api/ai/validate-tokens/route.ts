/**
 * AI Token Usage Enforcement Endpoint
 * 
 * POST /api/ai/validate-tokens
 * 
 * Purpose: Check if user has sufficient AI tokens available
 * before allowing an AI-powered action (response generation, automation, etc.)
 * 
 * Security:
 * - Validates session before allowing token check
 * - Returns plan information and remaining capacity
 * - Logs all token-limit violations for audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { PLANS } from '@/lib/plans';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { requestedTokens = 1000, action = 'ai_response' } = body;

    // Get user's workspace and plan information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, plan_type, subscription_status, payment_status')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      console.error('[AI Token Validation] User lookup failed:', userError);
      return NextResponse.json(
        { error: 'Unable to fetch user information' },
        { status: 500 }
      );
    }

    // Check if user is on a paid, active subscription
    if (userData.subscription_status !== 'active' || userData.payment_status !== 'paid') {
      await supabase.from('logs').insert({
        user_id: userData.id,
        level: 'warn',
        message: 'AI token request from non-active subscription',
        meta: {
          reason: 'subscription_inactive',
          subscription_status: userData.subscription_status,
          payment_status: userData.payment_status,
          action,
          requested_tokens: requestedTokens,
        },
      }).catch(err => console.error('[AI Token Validation] Logging error:', err));

      return NextResponse.json(
        {
          error: 'AI features require an active paid subscription',
          allowed: false,
          plan: null,
        },
        { status: 403 }
      );
    }

    // Get plan information
    const planType = userData.plan_type || 'starter';
    const plan = PLANS[planType as keyof typeof PLANS];

    if (!plan) {
      console.error('[AI Token Validation] Invalid plan type:', planType);
      return NextResponse.json(
        { error: 'Invalid plan configuration' },
        { status: 500 }
      );
    }

    const monthlyTokenLimit = plan.limits.aiTokenLimit;

    // Enterprise or unlimited tokens
    if (monthlyTokenLimit === -1) {
      return NextResponse.json({
        allowed: true,
        plan: planType,
        planName: plan.name,
        tokenLimit: -1,
        remaining: -1,
        message: 'Unlimited AI tokens available',
      });
    }

    // Check current month's token usage
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data: usage, error: usageError } = await supabase
      .from('ai_token_usage')
      .select('tokens_used')
      .eq('user_id', userData.id)
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    if (usageError) {
      console.error('[AI Token Validation] Usage lookup failed:', usageError);
      return NextResponse.json(
        { error: 'Unable to fetch token usage' },
        { status: 500 }
      );
    }

    const tokensUsedThisMonth = (usage || []).reduce((sum, row) => sum + (row.tokens_used || 0), 0);
    const remainingTokens = monthlyTokenLimit - tokensUsedThisMonth;

    // Check if user has enough tokens
    if (remainingTokens < requestedTokens) {
      // Log violation for audit
      await supabase.from('logs').insert({
        user_id: userData.id,
        level: 'warn',
        message: 'AI token limit violation: Insufficient tokens for requested action',
        meta: {
          reason: 'insufficient_tokens',
          plan_type: planType,
          monthly_limit: monthlyTokenLimit,
          tokens_used: tokensUsedThisMonth,
          remaining_tokens: remainingTokens,
          requested_tokens: requestedTokens,
          action,
        },
      }).catch(err => console.error('[AI Token Validation] Logging error:', err));

      console.warn(
        `[AI Token Validation] User ${userData.id} (${planType}) insufficient tokens: ` +
        `${remainingTokens} remaining, ${requestedTokens} requested`
      );

      return NextResponse.json(
        {
          allowed: false,
          plan: planType,
          planName: plan.name,
          tokenLimit: monthlyTokenLimit,
          used: tokensUsedThisMonth,
          remaining: remainingTokens,
          requested: requestedTokens,
          error: `Insufficient AI tokens. You have ${remainingTokens.toLocaleString()} tokens remaining. ` +
                 `This action requires ${requestedTokens.toLocaleString()} tokens. ` +
                 `Upgrade to ${plan.name === 'Starter' ? 'Pro' : 'Advanced'} plan for more tokens.`,
        },
        { status: 403 }
      );
    }

    // Log successful authorization
    await supabase.from('logs').insert({
      user_id: userData.id,
      level: 'info',
      message: 'AI action authorized - token check passed',
      meta: {
        plan_type: planType,
        monthly_limit: monthlyTokenLimit,
        tokens_used: tokensUsedThisMonth,
        remaining_tokens: remainingTokens,
        requested_tokens: requestedTokens,
        action,
      },
    }).catch(err => console.error('[AI Token Validation] Logging error:', err));

    return NextResponse.json({
      allowed: true,
      plan: planType,
      planName: plan.name,
      tokenLimit: monthlyTokenLimit,
      used: tokensUsedThisMonth,
      remaining: remainingTokens,
      message: `${remainingTokens.toLocaleString()} tokens available`,
    });
  } catch (error) {
    console.error('[AI Token Validation] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
