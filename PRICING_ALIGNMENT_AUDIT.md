# PRICING ALIGNMENT AUDIT

**Authority Document:** PRICING_REFERENCE.MD  
**Date:** January 13, 2026  
**Status:** CONFLICTS IDENTIFIED - ALIGNMENT REQUIRED

---

## CONFLICTS IDENTIFIED

### ⚠️ CONFLICT 1: PRICING PAGE - WRONG PLAN NAMES & PRICES

**File:** `app/pricing/page.tsx` - PLANS array  

**Current Code:**
```javascript
{ id: 'starter', name: 'Starter', price: 22, ... }      // USD
{ id: 'pro', name: 'Pro', price: 45, ... }              // USD
{ id: 'enterprise', name: 'Enterprise', price: 75, ... } // USD
```

**PRICING_REFERENCE.MD Says:**
```
Starter    BWP 25 / $350
Pro        BWP 36 / $600
Advanced   BWP 72 / $900
Enterprise Contact Sales
```

**Issues:**
1. ❌ **Missing "Advanced" plan** - PRICING_REFERENCE defines 4 tiers, not 3
2. ❌ **Starter price wrong** - Shows $22, should be $350 (or display BWP 25)
3. ❌ **Pro price wrong** - Shows $45, should be $600
4. ❌ **Enterprise has pricing** - Should show "Contact Sales", not $75/month
5. ❌ **Enterprise description misleading** - Says "Enterprise solution with full customization" and lists "All features unlocked" - but per PRICING_REFERENCE, Enterprise is custom/negotiated only

**REQUIRES CHANGE:** Replace 3-plan layout with 4-plan (Starter/Pro/Advanced/Enterprise)

---

### ⚠️ CONFLICT 2: FEATURES LIST - OUTDATED

**File:** `app/pricing/page.tsx` - PLANS.features arrays

**Current:**
```
Starter: ['Facebook Messenger auto-reply', 'Comment-to-DM (100/month)', '1 Facebook Page', ...]
Pro: ['Facebook + Instagram', 'Comment-to-DM (500/month)', '3 Pages/Accounts', ...]
Enterprise: ['All features unlocked', 'Unlimited pages/accounts', ...]
```

**PRICING_REFERENCE.MD says:**
```
Starter: Facebook OR Instagram + Website Chat
Pro: Facebook + Instagram + Website Chat
Advanced: Facebook + Instagram + Website Chat
Enterprise: All Channels (custom)
```

**Issues:**
1. ❌ **Missing Website Chat** - Listed as included for all paid plans
2. ❌ **No mention of AI Token Limits** - Starter (50K), Pro (150K), Advanced (500K)
3. ❌ **Support levels wrong/incomplete** - Starter should show "Community Support", Pro/Advanced "Priority Support"
4. ❌ **"Page" language** - MD says "Channels & Inbox", pricing page says "Pages/Accounts"
5. ❌ **"Comment-to-DM limit" not listed** - But is in feature gates code (100/500/unlimited)

**REQUIRES CHANGE:** Update feature lists to match PRICING_REFERENCE exactly

---

### ⚠️ CONFLICT 3: PRICING QUERIES - WRONG PLAN LIST

**File:** `app/lib/supabase/queries.ts` - `getAllPlans()` staticPlans array

**Current:**
```typescript
staticPlans = [
  { id: 'starter', price_monthly: 22, included_monthly_usage: 1000, ... },
  { id: 'pro', price_monthly: 45, included_monthly_usage: 5000, ... },
  { id: 'enterprise', price_monthly: 75, included_monthly_usage: 20000, ... },
]
```

**PRICING_REFERENCE.MD says:**
```
Starter: 50,000 tokens/month
Pro: 150,000 tokens/month
Advanced: 500,000 tokens/month
Enterprise: Custom (negotiated)
```

**Issues:**
1. ❌ **Starter: 1,000 token limit** - Should be 50,000
2. ❌ **Pro: 5,000 token limit** - Should be 150,000
3. ❌ **Enterprise: 20,000 token limit** - Should be NULL/custom (no static limit)
4. ❌ **Missing "Advanced" plan** - Only 3 plans returned, need 4
5. ❌ **Price values wrong** - Shows USD $22/$45/$75, but reference uses BWP 25/36/72

**REQUIRES CHANGE:** Fix token limits and add Advanced plan

---

### ⚠️ CONFLICT 4: FEATURE GATES - REFERENCES WRONG PLAN

**File:** `app/lib/feature-gates.ts` - getLockReason()

**Current:**
```typescript
case 'Instagram':
  return 'Instagram is only available on Pro and Enterprise plans.';
```

**PRICING_REFERENCE.MD says:**
```
Pro: Facebook + Instagram + Website Chat
Advanced: Facebook + Instagram + Website Chat
Enterprise: All Channels (custom)
```

**Issues:**
1. ❌ **Should mention Advanced** - Returns "Pro and Enterprise" but should be "Pro, Advanced, and Enterprise"
2. ⚠️ **Implies Enterprise has Instagram** - True, but PRICING_REFERENCE says Enterprise is custom, so message is misleading

**REQUIRES CHANGE:** Update message to include Advanced

---

### ⚠️ CONFLICT 5: DEPRECATED REPLIT-DB - OUTDATED PLAN_LIMITS

**File:** `app/lib/replit-db/index.ts` - PLAN_LIMITS constant

**Current:**
```typescript
export const PLAN_LIMITS = {
  starter: { maxPages: 1, hasInstagram: false, commentToDmLimit: 100, ... },
  pro: { maxPages: 3, hasInstagram: true, commentToDmLimit: 500, ... },
  enterprise: { maxPages: -1, hasInstagram: true, commentToDmLimit: -1, ... },
};
```

**Status:** ❌ DEPRECATED - File has `throw new Error('Replit-based storage has been removed...')`  
**Issue:** Code is unreachable but still exported. Misleading if someone looks at this file.

**REQUIRES CHANGE:** Remove PLAN_LIMITS from deprecated file (or note it's for reference only)

---

### ❌ CONFLICT 6: FEATURE GATES DESIGN ISSUE

**File:** `app/lib/feature-gates.ts` - UserSubscription interface

**Current:**
```typescript
export interface UserSubscription {
  subscription_status?: string;
  payment_status?: string;
  plan_type?: string;
  plan_limits?: { maxPages, hasInstagram, hasAiResponses, commentToDmLimit, price };
}
```

**PRICING_REFERENCE.MD says:**
```
- Starter / Pro / Advanced plan tiers
- AI token limits (50K/150K/500K)
- No Enterprise pricing/enforcement
- Features: channels, automation level, AI support, limits
```

**Issues:**
1. ⚠️ **No AI token limit field** - plan_limits has no `aiTokenLimit` or `monthlyTokens`
2. ❌ **No plan tier enforcement** - feature-gates doesn't validate plan_type against available plans
3. ❌ **Enterprise logic included** - Functions treat Enterprise same as Pro (should be read-only)

**REQUIRES CHANGE:** Add AI token limit to plan_limits, validate plan_type values

---

## SUMMARY OF REQUIRED CHANGES

| File | Issue | Fix |
|------|-------|-----|
| `app/pricing/page.tsx` | Only 3 plans (missing Advanced); Wrong prices; Enterprise has pricing | Add Advanced plan; Fix prices to match PRICING_REFERENCE; Remove Enterprise price ("Contact Sales") |
| `app/pricing/page.tsx` | Feature lists outdated/incomplete | Add Website Chat; Add AI Token Limits; Show Support levels |
| `app/lib/supabase/queries.ts` | Token limits wrong; Missing Advanced | Fix: 50K/150K/500K; Add Advanced plan |
| `app/lib/feature-gates.ts` | Instagram message doesn't mention Advanced | Update to "Pro, Advanced, and Enterprise" |
| `app/lib/feature-gates.ts` | No AI token limit tracking | Add monthlyTokenLimit/aiTokenLimit field |
| `app/lib/replit-db/index.ts` | Deprecated but still exports PLAN_LIMITS | Keep as-is (unreachable code) or add comment |

---

## WHAT STAYS UNCHANGED (Per Instructions)

✅ Authentication system  
✅ Pricing tier count (now 4: Starter/Pro/Advanced/Enterprise)  
✅ Usage charges logic (not implemented, stays simple)  
✅ No new plan tiers created  
✅ Enterprise remains display-only (no enforcement logic)  
✅ AI token limits enforced backend-only (frontend displays only)

---

## NEXT STEPS

1. **Update pricing/page.tsx** - 4-plan layout aligned to PRICING_REFERENCE
2. **Update queries.ts** - getAllPlans() with correct token limits and Advanced tier
3. **Update feature-gates.ts** - Add Advanced mention and token limit field
4. **Verify** - No other pricing logic in codebase conflicts

