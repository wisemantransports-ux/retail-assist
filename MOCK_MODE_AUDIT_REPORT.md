# Mock Mode Configuration Audit Report

## 🚨 CRITICAL ISSUE FOUND

**Location:** [app/lib/env.ts](app/lib/env.ts#L32-L35)

**The Problem:**
The `useMockMode` getter has a **default value of `true`** when the environment variable is not set or empty.

```typescript
get useMockMode() {
  const val = getEnvVar('NEXT_PUBLIC_USE_MOCK_SUPABASE')
  return (typeof val !== 'undefined' && val !== '') ? val === 'true' : true  // ❌ DEFAULTS TO TRUE
}
```

**What This Means:**
- If `NEXT_PUBLIC_USE_MOCK_SUPABASE` is not set → mock mode is **ENABLED** ✅ (problematic)
- If `NEXT_PUBLIC_USE_MOCK_SUPABASE=""` (empty string) → mock mode is **ENABLED** ✅ (problematic)
- If `NEXT_PUBLIC_USE_MOCK_SUPABASE=false` → mock mode is **DISABLED** ✅ (correct)
- If `NEXT_PUBLIC_USE_MOCK_SUPABASE=true` → mock mode is **ENABLED** ✅ (correct)

**Why It's Happening:**
Even though your `.env.local` has the variable **commented out**, the code defaults to `true` when it's absent.

---

## Full Mock Mode Reference Table

| File Path | Line | Code | Explanation | Impact |
|-----------|------|------|-------------|--------|
| [app/lib/env.ts](app/lib/env.ts#L32-L35) | 32-35 | `return (typeof val !== 'undefined' && val !== '') ? val === 'true' : true` | **CRITICAL:** Defaults to `true` if env var not set or empty | Mock mode **ENABLED by default** even when env var is commented out |
| [app/lib/env.ts](app/lib/env.ts#L44-L47) | 44-47 | `return (typeof val !== 'undefined' && val !== '') ? val === 'true' : true` | Also defaults to `true` for `useMockPayments` | Mock payments **ENABLED by default** |
| [.env.local](.env.local#L16-L17) | 16-17 | `# NEXT_PUBLIC_USE_MOCK_SUPABASE=false` | Variable is **commented out** | System uses default value: `true` |
| [app/lib/supabase/client.ts](app/lib/supabase/client.ts#L54) | 54 | `if (env.useMockMode && (!url || !key)) return stubClient` | Returns stub client if mock mode enabled **AND** env vars missing | No real Supabase calls made |
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts#L378) | 378 | `if (process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true' \|\| process.env.MOCK_MODE === 'true')` | Sync to mock database if mock mode detected | User synced to mock DB instead of real Supabase |

---

## Mock Mode References by Category

### 1. Environment Variable Checks

| File | Line | Code | Type |
|------|------|------|------|
| [app/lib/env.ts](app/lib/env.ts#L29-L35) | 29-35 | `get useMockMode() { ... return ... ? val === 'true' : true }` | **DEFAULT to TRUE** ⚠️ |
| [app/lib/env.ts](app/lib/env.ts#L44-L47) | 44-47 | `get useMockPayments() { ... return ... ? val === 'true' : true }` | **DEFAULT to TRUE** ⚠️ |
| [app/lib/supabase/server.ts](app/lib/supabase/server.ts#L30) | 30 | `const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true'` | Direct string comparison |
| [app/lib/supabase/server.ts](app/lib/supabase/server.ts#L72) | 72 | `const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true'` | Direct string comparison |
| [app/lib/supabase/server.ts](app/lib/supabase/server.ts#L81) | 81 | `const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true'` | Direct string comparison |
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts#L378) | 378 | `if (process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true' \|\| process.env.MOCK_MODE === 'true')` | Also checks `MOCK_MODE` variable |

### 2. Mock Database Usage

| File | Line | Feature |
|------|------|---------|
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts#L378-L411) | 378-411 | Syncs user to mock database at `tmp/dev-seed/database.json` |
| [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts#L77-L125) | 77-125 | `ensureInternalUser()` in mock mode reads from local mock DB file |

### 3. Logging Statements with "mock"

| File | Line | Log Message |
|------|------|-------------|
| [app/lib/stripe/billing.ts](app/lib/stripe/billing.ts#L186) | 186 | `'[stripe] Mock mode: skipping webhook verification'` |
| [app/lib/paypal/server.ts](app/lib/paypal/server.ts#L19) | 19 | `'[PayPal] Mock mode: returning fake access token'` |
| [app/lib/paypal/billing.ts](app/lib/paypal/billing.ts#L21) | 21 | `'[PayPal] Mock mode: returning fake access token'` |
| [app/lib/paypal/billing.ts](app/lib/paypal/billing.ts#L208) | 208 | `'[PayPal] Mock mode: webhook verification passed'` |
| [app/lib/paypal/billing.ts](app/lib/paypal/billing.ts#L278) | 278 | `'[PayPal] Mock mode: subscription plan created'` |
| [app/lib/paypal/billing.ts](app/lib/paypal/billing.ts#L302) | 302 | `'[PayPal] Mock mode: subscription created'` |
| [app/lib/paypal/billing.ts](app/lib/paypal/billing.ts#L315) | 315 | `'[PayPal] Mock mode: subscription suspended'` |
| [app/lib/paypal/billing.ts](app/lib/paypal/billing.ts#L328) | 328 | `'[PayPal] Mock mode: subscription cancelled'` |
| [app/lib/logging/alerts.ts](app/lib/logging/alerts.ts#L20) | 20 | `'[alerts] Mock mode: alert would be sent'` |
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts#L380) | 380 | `'[INVITE ACCEPT] Mock mode detected, syncing user to mock database'` |
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts#L407) | 407 | `'[INVITE ACCEPT] User synced to mock database'` |

### 4. Fallback Mechanisms

| File | Line | Fallback | Problem |
|------|------|----------|---------|
| [app/lib/supabase/client.ts](app/lib/supabase/client.ts#L54) | 54 | Returns stub client if `env.useMockMode && (!url \|\| !key)` | Uses stub if mock enabled **and** env vars missing |
| [app/lib/supabase/client.ts](app/lib/supabase/client.ts#L62) | 62 | Returns stub client if `typeof window === 'undefined'` | SSR safety - returns stub during build |
| [app/lib/supabase/client.ts](app/lib/supabase/client.ts#L64) | 64 | Returns stub if `!url \|\| !key` | Falls back to stub if env vars missing |

---

## The Root Cause Flow

```
┌─────────────────────────────────────────┐
│  .env.local                             │
│  # NEXT_PUBLIC_USE_MOCK_SUPABASE=false  │  ← Commented out (not set)
└──────────────┬──────────────────────────┘
               │
               ↓
┌────────────────────────────────────────────────────────────┐
│  app/lib/env.ts                                            │
│  get useMockMode() {                                       │
│    const val = getEnvVar('NEXT_PUBLIC_USE_MOCK_SUPABASE')  │
│    // val = undefined (not set)                            │
│    return (typeof val !== 'undefined' && val !== '')       │
│            ? val === 'true'                                │
│            : true  ← ❌ DEFAULT TO TRUE                    │
│  }                                                         │
└──────────────┬───────────────────────────────────────────┘
               │
               ↓ env.useMockMode = true
┌──────────────────────────────────────────┐
│  All code checking env.useMockMode       │
│  ├─ app/lib/supabase/client.ts           │  Returns stub client
│  ├─ app/api/agents/route.ts              │  Uses mock data
│  ├─ app/api/automation-rules/route.ts    │  Uses mock data
│  └─ All other features...                │  Use mock mode
└──────────────────────────────────────────┘
               │
               ↓
          ❌ MOCK MODE ENABLED
```

---

## Quick Comparison

### How It Works Now (BROKEN)
```
NEXT_PUBLIC_USE_MOCK_SUPABASE not set
                ↓
env.useMockMode = true (DEFAULT)
                ↓
All code uses mock mode
                ↓
Login fails, invite fails, etc.
```

### How It Should Work (FIXED)
```
NEXT_PUBLIC_USE_MOCK_SUPABASE=false
                ↓
env.useMockMode = false
                ↓
All code uses real Supabase
                ↓
Login works, invite works, etc.
```

---

## Solution

### Option 1: Uncomment in .env.local (Immediate)
```bash
# Change this:
# NEXT_PUBLIC_USE_MOCK_SUPABASE=false

# To this:
NEXT_PUBLIC_USE_MOCK_SUPABASE=false
```

### Option 2: Change Default Logic (Permanent)
Replace the default logic in [app/lib/env.ts](app/lib/env.ts#L32-L35):

**From (defaults to TRUE):**
```typescript
get useMockMode() {
  const val = getEnvVar('NEXT_PUBLIC_USE_MOCK_SUPABASE')
  return (typeof val !== 'undefined' && val !== '') ? val === 'true' : true  // ❌
}
```

**To (defaults to FALSE):**
```typescript
get useMockMode() {
  const val = getEnvVar('NEXT_PUBLIC_USE_MOCK_SUPABASE')
  return (typeof val !== 'undefined' && val !== '') ? val === 'true' : false  // ✅
}
```

### Option 3: Require Explicit Configuration
```typescript
get useMockMode() {
  const val = getEnvVar('NEXT_PUBLIC_USE_MOCK_SUPABASE')
  if (typeof val === 'undefined' || val === '') {
    throw new Error(
      'NEXT_PUBLIC_USE_MOCK_SUPABASE must be explicitly set to "true" or "false". ' +
      'Set it in .env.local: NEXT_PUBLIC_USE_MOCK_SUPABASE=false'
    )
  }
  return val === 'true'
}
```

---

## Also Found: Secondary Variables

| Variable | File | Behavior |
|----------|------|----------|
| `NEXT_PUBLIC_USE_MOCK_PAYMENTS` | [app/lib/env.ts](app/lib/env.ts#L44) | **Also defaults to `true`** |
| `MOCK_MODE` | [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts#L378) | Alternative env var to trigger mock DB sync |
| `USE_MOCK_MODE` | Documentation only | Not used in code, only mentioned in docs |

---

## Files Using mock Mode

**Total: 40+ files**

- Payment processors: PayPal, Stripe
- Automation: Rules, webhooks, comments
- Authentication: dev-login, dev-logout
- Logging: Alerts
- APIs: Agents, chat, automation
- Core: Supabase client initialization
- Invites: Accept flow with mock DB sync

---

## Recommendation

**Immediate Fix:** Uncomment `NEXT_PUBLIC_USE_MOCK_SUPABASE=false` in `.env.local`

**Long-term Fix:** Change the default in `app/lib/env.ts` from `true` to `false` OR make it throw an error requiring explicit configuration.

The current setup means any developer who doesn't explicitly set this variable will have mock mode enabled, which is a common source of confusion.

---

**Generated:** January 25, 2026  
**Status:** 🚨 CRITICAL - Mock mode enabled by default
