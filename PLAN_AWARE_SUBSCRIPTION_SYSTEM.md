# Plan-Aware Subscription System - Implementation Guide

**Date**: January 17, 2026  
**Status**: Production Ready  
**Version**: 1.0  

---

## Executive Summary

This document describes the **plan-aware subscription system** implemented for Retail Assist, which enforces resource limits based on subscription tier across:

- **Employee management** - Max employees per plan
- **Channel connections** - Max social accounts (Facebook/Instagram) per plan
- **AI usage** - Monthly AI token allocation per plan
- **Automation rules** - Max rules per plan

All enforcement happens at both **frontend (UI gating)** and **backend (API validation)** layers, with comprehensive **audit logging** for compliance.

### Key Metrics

| Plan | Employees | Accounts | AI Tokens/mo | Automation Rules |
|------|-----------|----------|-------------|-----------------|
| Starter | 2 | 1 | 10K | 3 |
| Pro | 5 | 3 | 50K | 15 |
| Advanced | 15 | ∞ | 500K | ∞ |
| Enterprise | ∞ | ∞ | ∞ | ∞ |

---

## Architecture Overview

### Files Modified/Created

```
app/lib/
├── plans.ts                          ✅ NEW - Central plan configuration
├── feature-gates.ts                  ✅ UPDATED - New plan-aware functions
└── db/
    └── index.ts                      (EXISTING PLAN_LIMITS preserved)

app/api/
├── employees/route.ts                ✅ ENFORCES - Employee limit checks
├── meta/pages/route.ts               ✅ ENFORCES - Account limit checks
├── ai/
│   └── validate-tokens/route.ts      ✅ NEW - AI token validation
└── [webhooks, auth, etc]             (UNCHANGED)

app/dashboard/
└── integrations/page.tsx             ✅ UPDATED - Plan-aware UI display
```

### System Layers

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (React Components)                              │
│ - canConnectAccount() gates "Connect" buttons            │
│ - getPageCapacityMessage() displays usage               │
│ - Tooltips show why buttons are disabled                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ FEATURE GATES (app/lib/feature-gates.ts)                │
│ - canAddEmployee()                                      │
│ - canConnectAccount()                                   │
│ - canUseAI()                                            │
│ - getPageCapacityMessage()                              │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ API ENDPOINTS (Backend Enforcement)                      │
│ - POST /api/employees/invite → Check maxEmployees      │
│ - POST /api/meta/pages → Check maxPages                │
│ - POST /api/ai/validate-tokens → Check aiTokenLimit    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ DATABASE (Supabase)                                      │
│ - workspaces.plan_type (Starter|Pro|Advanced|Enterprise)│
│ - logs table (audit trail)                              │
│ - ai_token_usage table (monthly tracking)               │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Central Plan Configuration

### Location
`app/lib/plans.ts` - Single source of truth for all subscription tiers

### Structure

```typescript
export type PlanType = 'starter' | 'pro' | 'advanced' | 'enterprise';

export interface PlanDefinition {
  id: PlanType;
  name: string;
  price: number;
  limits: {
    maxEmployees: number;    // -1 = unlimited
    maxPages: number;        // Connected social accounts
    maxChannels: number;     // Total integrations
    aiTokenLimit: number;    // Monthly AI token budget
    automationRuleLimit: number;
  };
  features: {
    hasInstagram: boolean;
    hasAiResponses: boolean;
    // ... other feature flags
  };
  operations: {
    commentToDmLimit: number;
    messageLimit: number;
    automationLevel: 'basic' | 'advanced' | 'enterprise';
  };
}

export const PLANS: Record<PlanType, PlanDefinition> = {
  starter: { ... },
  pro: { ... },
  advanced: { ... },
  enterprise: { ... },
};
```

### Utility Functions

```typescript
// Get a plan
getPlan('pro')  →  PlanDefinition

// Check specific limit
getPlanLimit('pro', 'maxEmployees')  →  5

// Check if unlimited
isPlanLimitUnlimited('advanced', 'maxPages')  →  true

// Calculate remaining capacity
getRemainingCapacity('starter', 'maxEmployees', 1)  →  1

// Get user-friendly message
getCapacityMessage('pro', 'maxEmployees', 3)  →  "3 of 5 employees used"
```

---

## 2. Feature Gate Functions

### Location
`app/lib/feature-gates.ts` - Enhanced with plan-aware functions

### New Functions

#### 1. `canConnectAccount(user, currentPageCount?, platform?): boolean`

Checks if user can connect another account (Facebook/Instagram/Web).

```typescript
// Starter: Max 1 account
if (canConnectAccount(starterUser, 1)) {  // false - at limit
}

// Pro: Max 3 accounts  
if (canConnectAccount(proUser, 2)) {      // true - can add 1 more
}

// Enterprise: Unlimited
if (canConnectAccount(enterpriseUser, 100)) {  // true - unlimited
}
```

#### 2. `canAddChannelForPlatform(user, platform, fbCount, igCount): boolean`

Checks if user can add a specific platform account.

```typescript
// Starter: Can only have 1 account total (Facebook OR Instagram, not both)
canAddChannelForPlatform(starterUser, 'facebook', 1, 0)  // false
canAddChannelForPlatform(starterUser, 'facebook', 0, 1)  // false - has IG

// Pro: Can have multiple
canAddChannelForPlatform(proUser, 'facebook', 1, 1)  // true - can add to 3 max
```

#### 3. `canUseAI(user, requestedTokens?, currentTokenUsage?): boolean`

Checks if user has sufficient AI tokens.

```typescript
// Starter: 10K tokens/month
canUseAI(starterUser, 5000, 6000)   // false - only 4K remaining
canUseAI(starterUser, 3000, 6000)   // true - 4K remaining, 3K needed

// Enterprise: Unlimited
canUseAI(enterpriseUser, 999999, 0) // true - unlimited
```

#### 4. `getRemainingAITokens(user, currentUsage?): number`

Returns tokens available this month.

```typescript
// Returns -1 if unlimited
getRemainingAITokens(enterpriseUser)  // -1

// Returns number for limited plans
getRemainingAITokens(proUser, 25000)  // 25000 (50K - 25K used)
```

#### 5. `getPageCapacityMessage(user, currentPageCount?): string`

User-friendly message about account limits.

```typescript
getPageCapacityMessage(proUser, 2)    // "2 of 3 accounts connected"
getPageCapacityMessage(proUser, 3)    // "Your Pro plan allows only 3 account(s). Upgrade to connect more."
getPageCapacityMessage(enterpriseUser) // "Unlimited account connections"
```

#### 6. `getAITokenMessage(user, currentTokenUsage?): string`

User-friendly message about AI token usage.

```typescript
getAITokenMessage(proUser, 25000)
// "50% of monthly AI tokens used (25,000 of 50,000)"

getAITokenMessage(enterpriseUser)
// "Unlimited AI tokens"
```

#### 7. `canCreateAutomationRule(user, currentRuleCount?): boolean`

Checks if user can create more automation rules.

```typescript
canCreateAutomationRule(starterUser, 3)  // false - at 3 max
canCreateAutomationRule(proUser, 15)     // false - at 15 max
canCreateAutomationRule(advancedUser, 100) // true - unlimited
```

---

## 3. Backend Enforcement

### POST /api/employees/invite

**File**: `app/api/employees/route.ts`

**Flow**:
1. Session validation (401)
2. Email validation (400)
3. Role validation - admin only (403)
4. **PLAN ENFORCEMENT** (403)
   - Fetch workspace plan type
   - Count current employees
   - Check if `currentCount >= maxEmployees`
   - Return 403 if at limit
5. Create invite token (201)

**Error Response** (403):
```json
{
  "error": "Your Starter plan allows only 2 employee(s). You currently have 2. Upgrade to add more.",
  "plan": "starter",
  "limit": 2,
  "current": 2
}
```

**Logging**:
```
level: "warn"
message: "Employee limit violation: Attempted to invite employee when at limit"
meta: {
  reason: "plan_limit_exceeded",
  plan_type: "starter",
  max_employees: 2,
  current_employees: 2,
  invitee_email: "new@example.com"
}
```

---

### POST /api/meta/pages

**File**: `app/api/meta/pages/route.ts`

**Flow**:
1. Session validation (401)
2. Subscription validation (403)
3. Token validation (400 - invalid/expired)
4. **PLAN ENFORCEMENT** (403)
   - Starter: Reject if user already has 1 account and trying to add another
   - Pro/Advanced: Check against `maxPages` limit
   - Enterprise: Unlimited
5. Save pages to DB (201)

**Error Response** (403):
```json
{
  "error": "Starter plan allows only one account. Upgrade to connect another."
}
```

**Logging**:
```
level: "warn"
message: "Starter plan violation: Attempted to connect 2 Facebook accounts"
meta: {
  plan: "starter",
  platform: "facebook",
  attemptedCount: 2,
  reason: "Starter plan allows only one account"
}
```

---

### POST /api/ai/validate-tokens

**File**: `app/api/ai/validate-tokens/route.ts` (NEW)

**Flow**:
1. Session validation (401)
2. Subscription validation (403)
3. **AI TOKEN ENFORCEMENT** (403)
   - Fetch user's monthly AI token limit
   - Count tokens used this month
   - Check if `remaining >= requestedTokens`
   - Return 403 if insufficient
4. Allow action (200)

**Request**:
```json
POST /api/ai/validate-tokens
{
  "requestedTokens": 1000,
  "action": "ai_response"
}
```

**Response** (200 - Success):
```json
{
  "allowed": true,
  "plan": "pro",
  "planName": "Pro",
  "tokenLimit": 50000,
  "used": 25000,
  "remaining": 25000,
  "message": "25,000 tokens available"
}
```

**Response** (403 - Failure):
```json
{
  "allowed": false,
  "plan": "starter",
  "planName": "Starter",
  "tokenLimit": 10000,
  "used": 8000,
  "remaining": 2000,
  "requested": 5000,
  "error": "Insufficient AI tokens. You have 2,000 tokens remaining. This action requires 5,000 tokens. Upgrade to Pro plan for more tokens."
}
```

---

## 4. Frontend UI Updates

### Location
`app/dashboard/integrations/page.tsx`

### Plan Capacity Display

Shows current usage as blue info box:
```
Account Capacity: 2 of 3 accounts connected
```

### Button Disabling Logic

```typescript
// Disable if user at limit
disabled={
  loading || 
  !user || 
  !canConnectFacebook(user) || 
  !canConnectAccount(user, connectedPages.length)
}

// Tooltip explains why
title={
  !canConnectFacebook(user) 
    ? 'Upgrade to a paid plan to connect Facebook'
    : !canConnectAccount(user, connectedPages.length)
    ? `You've reached your ${user.plan_type} plan limit. Upgrade to add more.`
    : ''
}
```

### Badge Display

When button is disabled:
```
🔒 Paid only     (if not subscribed)
⚠️ Limit reached (if at capacity)
Pro plan required (if wrong plan tier)
```

### Example UI States

**Starter User, No Accounts Connected**:
- Button: Enabled (blue)
- Message: "1 of 1 accounts connected"

**Starter User, 1 Account Connected**:
- Button: Disabled (opacity-50)
- Badge: "⚠️ Limit reached"
- Tooltip: "You've reached your Starter plan limit. Upgrade to add more."

**Pro User, 3 Accounts Connected**:
- Button: Disabled
- Message: "3 of 3 accounts connected"
- Badge: "⚠️ Limit reached"

**Enterprise User**:
- Button: Always enabled
- Message: "Unlimited account connections"

---

## 5. Audit Logging

### Log Structure

```typescript
{
  user_id: "uuid",
  level: "info" | "warn" | "error",
  message: "Action description",
  meta: {
    // Context-specific metadata
    plan_type: "pro",
    action: "employee_invite",
    reason: "plan_limit_exceeded",
    current_count: 5,
    max_limit: 5,
    // ... more fields
  },
  created_at: "2026-01-17T10:00:00Z"
}
```

### Log Types

#### Employee Violations
```
level: "warn"
message: "Employee limit violation: Attempted to invite employee when at limit"
meta: {
  reason: "plan_limit_exceeded",
  plan_type: "starter",
  max_employees: 2,
  current_employees: 2,
  invitee_email: "new@example.com"
}
```

#### Account Connection Violations
```
level: "warn"
message: "Starter plan violation: Attempted to connect 2 Facebook accounts"
meta: {
  plan: "starter",
  platform: "facebook",
  attemptedCount: 2,
  existingCount: 1,
  reason: "Starter plan allows only one account total"
}
```

#### AI Token Violations
```
level: "warn"
message: "AI token limit violation: Insufficient tokens for requested action"
meta: {
  reason: "insufficient_tokens",
  plan_type: "starter",
  monthly_limit: 10000,
  tokens_used: 8000,
  remaining_tokens: 2000,
  requested_tokens: 5000,
  action: "ai_response"
}
```

#### Successful Actions
```
level: "info"
message: "Created employee invite: new@example.com"
meta: {
  workspace_id: "uuid",
  plan_type: "pro",
  current_employees: 3,
  max_employees: 5
}
```

---

## 6. Testing Scenarios

### Employee Limits

**TE-1: Starter - Add 1st Employee (Success)**
- Current: 0/2
- Action: Invite employee
- Expected: ✅ Success (201)

**TE-2: Starter - Add 2nd Employee (Success)**
- Current: 1/2
- Action: Invite employee
- Expected: ✅ Success (201)

**TE-3: Starter - Add 3rd Employee (Failure)**
- Current: 2/2
- Action: Invite employee
- Expected: ❌ 403 "Your Starter plan allows only 2 employee(s)"

**TE-4: Pro - Add 5th Employee (Success)**
- Current: 4/5
- Action: Invite employee
- Expected: ✅ Success (201)

**TE-5: Pro - Add 6th Employee (Failure)**
- Current: 5/5
- Action: Invite employee
- Expected: ❌ 403 "Your Pro plan allows only 5 employee(s)"

**TE-6: Advanced - Add 15th Employee (Success)**
- Current: 14/15
- Action: Invite employee
- Expected: ✅ Success (201)

**TE-7: Enterprise - Add 100th Employee (Success)**
- Current: 99/∞
- Action: Invite employee
- Expected: ✅ Success (201) - unlimited

### Account Connection Limits

**TA-1: Starter - Connect 1st Account (Success)**
- Current: 0/1
- Action: Connect Facebook
- Expected: ✅ Success (201)

**TA-2: Starter - Connect 2nd Account (Failure)**
- Current: 1/1 (Facebook)
- Action: Connect Instagram
- Expected: ❌ 403 "Starter plan allows only one account"

**TA-3: Pro - Connect 1st, 2nd, 3rd Account (Success)**
- Current: 0/3 → 1/3 → 2/3 → 3/3
- Action: Connect each
- Expected: ✅ All succeed (201)

**TA-4: Pro - Connect 4th Account (Failure)**
- Current: 3/3
- Action: Connect 4th
- Expected: ❌ 403 "You can only add 0 more page(s)"

**TA-5: Advanced - Connect Unlimited Accounts (Success)**
- Current: 10/∞
- Action: Keep connecting
- Expected: ✅ All succeed

### AI Token Limits

**TAI-1: Starter - Use 5K Tokens (Success)**
- Monthly limit: 10K
- Used this month: 2K
- Remaining: 8K
- Action: Request 5K tokens for AI response
- Expected: ✅ 200 "allowed: true"

**TAI-2: Starter - Use 10K Tokens (Failure)**
- Monthly limit: 10K
- Used this month: 8K
- Remaining: 2K
- Action: Request 5K tokens
- Expected: ❌ 403 "Insufficient AI tokens"

**TAI-3: Pro - Half Month Usage (Success)**
- Monthly limit: 50K
- Used this month: 20K
- Remaining: 30K
- Action: Request 10K tokens
- Expected: ✅ 200 "allowed: true"

**TAI-4: Enterprise - Unlimited Tokens (Success)**
- Monthly limit: ∞
- Used this month: 999K
- Action: Request any amount
- Expected: ✅ 200 "allowed: true"

### Frontend Button States

**TFE-1: Integrations - Starter User at Limit**
- Current: 1 account connected (1/1 limit)
- Action: View integrations page
- Expected: 
  - Button: Disabled
  - Badge: "⚠️ Limit reached"
  - Message: "1 of 1 accounts connected"

**TFE-2: Integrations - Pro User Below Limit**
- Current: 2 accounts connected (2/3 limit)
- Action: View integrations page
- Expected:
  - Button: Enabled
  - Message: "2 of 3 accounts connected"

**TFE-3: Integrations - Free User**
- Plan: Free (unpaid)
- Action: View integrations page
- Expected:
  - Button: Disabled
  - Badge: "🔒 Paid only"
  - Message: "Upgrade to connect accounts"

### Plan Upgrade/Downgrade

**TUP-1: Starter → Pro Upgrade**
- Before: 2/2 employees, at limit
- After: 2/5 employees, can add 3 more
- Expected:
  - Button enabled
  - Message: "2 of 5 employees used"

**TDN-1: Pro → Starter Downgrade**
- Before: 3 accounts connected (3/3)
- After: 3 accounts in system, but 1/1 allowed on Starter
- Expected:
  - UI shows: "⚠️ Over plan limit"
  - Button disabled
  - Message: "You have 3 accounts but Starter plan allows only 1"

---

## 7. Deployment Checklist

- [ ] Code review of plans.ts
- [ ] Code review of feature-gates.ts updates
- [ ] Code review of endpoint updates
- [ ] Code review of UI updates
- [ ] Verify all imports are correct
- [ ] Run TypeScript compiler (`npm run build`)
- [ ] Test all 15+ scenarios locally
- [ ] Test on mobile devices
- [ ] Deploy to staging
- [ ] Run full staging test suite
- [ ] Monitor logs for violations (24 hours)
- [ ] Deploy to production
- [ ] Monitor production logs
- [ ] Alert if violations > 10/day (sign of UX issue)

---

## 8. Monitoring & Alerting

### Key Metrics

```sql
-- Employee limit violations per day
SELECT DATE(created_at), COUNT(*) as violations
FROM logs
WHERE message LIKE '%employee limit violation%'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- Account connection violations per day
SELECT DATE(created_at), COUNT(*) as violations
FROM logs
WHERE message LIKE '%plan violation%' AND message LIKE '%account%'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- AI token violations per day
SELECT DATE(created_at), COUNT(*) as violations
FROM logs
WHERE message LIKE '%token limit violation%'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- Conversion: Violations → Upgrades
SELECT 
  COUNT(CASE WHEN level = 'warn' THEN 1 END) as violations,
  COUNT(CASE WHEN message LIKE '%upgrade%' THEN 1 END) as upgrade_mentions
FROM logs
WHERE created_at >= NOW() - INTERVAL '30 days';
```

### Alerts

Set up alerts for:
- **Employee violations > 5/day**: UX issue or educational gap
- **Account violations > 10/day**: Popular feature, consider lower starting tier
- **AI token violations trending up**: Tokens too restrictive

---

## 9. Future Enhancements

### Phase 2
- [ ] Soft limits (warning before hard limit)
- [ ] Email notifications when nearing limits
- [ ] In-app notifications and upgrade prompts
- [ ] Plan upgrade flow within dashboard
- [ ] Custom limits per contract (Enterprise)
- [ ] Grace period (24-48 hours) for overages
- [ ] Usage analytics by feature

### Phase 3
- [ ] A/B testing of limit messaging
- [ ] Predictive capacity warnings
- [ ] Auto-scaling for overage charges
- [ ] Spend tracking and forecasting

---

## 10. Backward Compatibility

✅ **No breaking changes**

- Legacy `PLAN_LIMITS` object in `app/lib/db/index.ts` still works
- Existing code using `getMaxPages()`, `getMaxEmployees()` unchanged
- New plans.ts is additive - old patterns still supported
- API responses include both new and legacy fields for transition period
- Database schema unchanged - uses existing `plan_type` field

---

## Support & Troubleshooting

### User Sees "Limit Reached" But Should Have Capacity

1. Check user's plan_type in database
   ```sql
   SELECT plan_type, subscription_status FROM users WHERE id = '...';
   ```

2. Count resources
   ```sql
   -- Employees
   SELECT COUNT(*) FROM employees WHERE workspace_id = '...';
   
   -- Accounts
   SELECT COUNT(*) FROM tokens WHERE user_id = '...';
   ```

3. Verify plan configuration
   ```typescript
   // In app/lib/plans.ts
   const plan = PLANS[planType];
   console.log(`Max employees: ${plan.limits.maxEmployees}`);
   ```

### Audit Log Not Recording

1. Check logs table exists
   ```sql
   SELECT * FROM logs WHERE user_id = '...' LIMIT 10;
   ```

2. Check for SQL errors in API console

3. Verify Supabase RLS policies allow insert

### Button Still Enabled When Should Be Disabled

1. Check user data is loaded
   ```typescript
   console.log('User plan:', user?.plan_type);
   console.log('Connected pages:', connectedPages.length);
   ```

2. Verify feature gate function
   ```typescript
   console.log('Can connect?', canConnectAccount(user, connectedPages.length));
   ```

3. Check plan configuration
   ```typescript
   import { PLANS } from '@/lib/plans';
   console.log('Max pages:', PLANS[user.plan_type]?.limits.maxPages);
   ```

---

## Related Documentation

- [EMPLOYEE_PLAN_LIMITS_QUICK_REF.md](EMPLOYEE_PLAN_LIMITS_QUICK_REF.md) - Developer quick reference
- [EMPLOYEE_PLAN_LIMITS_TEST_SCENARIOS.md](EMPLOYEE_PLAN_LIMITS_TEST_SCENARIOS.md) - Complete test plan
- [PRICING_REFERENCE.MD](PRICING_REFERENCE.MD) - Pricing and feature details
- [FACEBOOK_INSTAGRAM_AUDIT_REPORT.md](FACEBOOK_INSTAGRAM_AUDIT_REPORT.md) - Integration details

---

**Last Updated**: January 17, 2026  
**Maintained By**: Engineering Team  
**Version**: 1.0 (Production Ready)
