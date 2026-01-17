# Plan-Aware Subscription System - Quick Reference

**Status**: Production Ready | **Version**: 1.0 | **Last Updated**: January 17, 2026

---

## Plan Limits at a Glance

| Feature | Starter | Pro | Advanced | Enterprise |
|---------|---------|-----|----------|-----------|
| **Price** | $22/mo | $45/mo | $95/mo | Custom |
| **Employees** | 2 | 5 | 15 | ∞ |
| **Accounts** | 1 | 3 | ∞ | ∞ |
| **AI Tokens/mo** | 10K | 50K | 500K | ∞ |
| **Automation Rules** | 3 | 15 | ∞ | ∞ |
| **Instagram** | ❌ | ✅ | ✅ | ✅ |
| **Advanced Reporting** | ❌ | ✅ | ✅ | ✅ |
| **Team Management** | ❌ | ✅ | ✅ | ✅ |

---

## Feature Gate Functions

### Employee Management

```typescript
import { canAddEmployee, getMaxEmployees, getEmployeeLimitMessage } from '@/lib/feature-gates';

// Can user add another employee?
if (canAddEmployee(user, currentCount)) {
  // Show invite button
}

// Get max employees
const max = getMaxEmployees(user);  // 2, 5, 15, or -1

// Display message
const msg = getEmployeeLimitMessage(user, currentCount);
// "2 of 5 employees used" or "Your Starter plan allows only 2..."
```

### Account Connections

```typescript
import { 
  canConnectAccount, 
  canAddChannelForPlatform,
  getPageCapacityMessage 
} from '@/lib/feature-gates';

// Can user add another account?
if (canConnectAccount(user, connectedPages.length)) {
  // Show connect button
}

// Can user add specific platform?
if (canAddChannelForPlatform(user, 'facebook', fbCount, igCount)) {
  // Allow Facebook connection
}

// Display usage
const msg = getPageCapacityMessage(user, connectedPages.length);
// "2 of 3 accounts connected"
```

### AI Features

```typescript
import { 
  canUseAI, 
  getAiTokenLimit,
  getRemainingAITokens,
  getAITokenMessage 
} from '@/lib/feature-gates';

// Can user use AI with requested tokens?
if (canUseAI(user, 1000, tokensUsedThisMonth)) {
  // Allow AI action
}

// Get limits
const limit = getAiTokenLimit(user);     // 10000, 50000, 500000, or -1
const remaining = getRemainingAITokens(user, used);

// Display message
const msg = getAITokenMessage(user, tokensUsedThisMonth);
// "50% of monthly AI tokens used (25,000 of 50,000)"
```

---

## API Endpoints

### POST /api/employees/invite

**Purpose**: Create employee invite  
**Auth**: Session required  
**Enforces**: maxEmployees per plan

```javascript
// Request
POST /api/employees/invite
Content-Type: application/json

{ "email": "new@example.com" }

// Success (201)
{ "success": true, "invite": { "id": "...", "token": "..." } }

// Failure - At Limit (403)
{
  "error": "Your Starter plan allows only 2 employee(s)...",
  "plan": "starter",
  "limit": 2,
  "current": 2
}
```

### POST /api/meta/pages

**Purpose**: Connect Facebook/Instagram accounts  
**Auth**: Session required  
**Enforces**: maxPages per plan

```javascript
// Request
POST /api/meta/pages
Content-Type: application/json

{
  "token": "base64-encoded-temp-token",
  "platform": "facebook",
  "selectedPageIds": ["123456"]
}

// Success (201)
{ "success": true, "pages": [{ "id": "...", "name": "..." }] }

// Failure - At Limit (403)
{ "error": "Starter plan allows only one account. Upgrade to connect another." }
```

### POST /api/ai/validate-tokens

**Purpose**: Check AI token availability  
**Auth**: Session required  
**Enforces**: aiTokenLimit per plan

```javascript
// Request
POST /api/ai/validate-tokens
Content-Type: application/json

{
  "requestedTokens": 1000,
  "action": "ai_response"
}

// Success (200)
{
  "allowed": true,
  "plan": "pro",
  "tokenLimit": 50000,
  "used": 25000,
  "remaining": 25000
}

// Failure - Insufficient Tokens (403)
{
  "allowed": false,
  "error": "Insufficient AI tokens. You have 2,000 remaining..."
}
```

---

## Frontend Integration

### Integrations Page (Connect Accounts)

```typescript
// Check if can connect
if (canConnectAccount(user, connectedPages.length)) {
  // Enable "Connect" button
} else {
  // Disable button + show "Limit reached" badge
}

// Show capacity message
<p>{getPageCapacityMessage(user, connectedPages.length)}</p>

// Handle API error
if (response.status === 403) {
  const data = await response.json();
  showError(data.error); // User-friendly message
}
```

### Employees Page (Add Employees)

```typescript
// Check if can add
if (canAddEmployee(user, employees.length)) {
  // Enable "Invite" button
} else {
  // Disable button + show warning
}

// Show usage
<p>{getEmployeeLimitMessage(user, employees.length)}</p>
```

### AI Features (Any Page Using AI)

```typescript
// Before generating AI response
const validation = await fetch('/api/ai/validate-tokens', {
  method: 'POST',
  body: JSON.stringify({ requestedTokens: 1000 })
});

if (!validation.ok) {
  const { error } = await validation.json();
  showError(error); // "Insufficient AI tokens..."
  return;
}

// Proceed with AI action
```

---

## Common Patterns

### Disable Button Based on Limit

```typescript
<button 
  disabled={
    loading || 
    !user || 
    !isPaidUser(user) || 
    !canConnectAccount(user, connectedPages.length)
  }
  title={
    !canConnectAccount(user, connectedPages.length)
      ? `Limit reached. ${getPageCapacityMessage(user, connectedPages.length)}`
      : ''
  }
>
  Connect Account
</button>
```

### Show Capacity Bar

```typescript
{user && !isFreeUser(user) && (
  <div className="bg-blue-900/30 border border-blue-600 p-4 rounded">
    <p className="text-blue-200 text-sm">
      <strong>Capacity:</strong> {getPageCapacityMessage(user, connectedPages.length)}
    </p>
  </div>
)}
```

### Show Warning Banner

```typescript
{canConnectAccount(user, connectedPages.length) === false && (
  <div className="bg-orange-900/30 border border-orange-600 p-4 rounded">
    <p className="text-orange-200 text-sm">
      ⚠️ You've reached your plan's {name} limit. 
      <a href="/upgrade" className="underline">Upgrade now</a> to add more.
    </p>
  </div>
)}
```

---

## Testing Checklist

### Employee Limits
- [ ] Starter: 0 → 1 → 2 (then fails on 3)
- [ ] Pro: 0 → 5 (then fails on 6)
- [ ] Advanced: 0 → 15+ (then fails)
- [ ] Enterprise: Always succeeds

### Account Limits
- [ ] Starter: 1 account max (fail if try 2nd)
- [ ] Pro: 1 → 3 accounts (fail on 4th)
- [ ] Advanced: Unlimited (always succeeds)

### AI Tokens
- [ ] Starter: 10K limit enforced
- [ ] Pro: 50K limit enforced
- [ ] Enterprise: Unlimited

### UI States
- [ ] Free user: All buttons disabled
- [ ] Paid at limit: Button disabled + warning badge
- [ ] Paid below limit: Button enabled
- [ ] Plan upgrade: Limits update immediately

---

## Debugging

### Check User Plan

```typescript
// In browser console
fetch('/api/auth/me').then(r => r.json()).then(console.log);

// Look for:
// user.plan_type: 'starter' | 'pro' | 'advanced' | 'enterprise'
// user.subscription_status: 'active'
// user.payment_status: 'paid'
```

### Check Current Usage

```typescript
// Employees
fetch('/api/employees').then(r => r.json()).then(d => console.log(d.length + ' employees'));

// Accounts
fetch('/api/meta/pages').then(r => r.json()).then(d => console.log(d.pages.length + ' accounts'));
```

### Query Limits from Code

```typescript
import { PLANS } from '@/lib/plans';

const plan = PLANS['pro'];
console.log('Max employees:', plan.limits.maxEmployees);
console.log('Max accounts:', plan.limits.maxPages);
console.log('AI tokens:', plan.limits.aiTokenLimit);
```

### Check Logs for Violations

```sql
-- Last 24 hours of violations
SELECT * FROM logs 
WHERE level = 'warn' 
AND (message LIKE '%limit%' OR message LIKE '%violation%')
AND created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

---

## Error Messages Users See

### Employee Limit
```
"Your Starter plan allows only 2 employee(s). You currently have 2. Upgrade to add more."
```

### Account Limit
```
"Starter plan allows only one account. Upgrade to connect another."
```

### AI Token Limit
```
"Insufficient AI tokens. You have 2,000 tokens remaining. This action requires 5,000 tokens. Upgrade to Pro plan for more tokens."
```

### Free User
```
"Facebook integration requires a paid subscription. Upgrade to connect your Facebook page."
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/lib/plans.ts` | Central plan definitions |
| `app/lib/feature-gates.ts` | Feature gating functions |
| `app/api/employees/route.ts` | Employee invite enforcement |
| `app/api/meta/pages/route.ts` | Account connection enforcement |
| `app/api/ai/validate-tokens/route.ts` | AI token validation |
| `app/dashboard/integrations/page.tsx` | UI with plan awareness |

---

## Deployment Reminders

✅ Run `npm run build` before deploying  
✅ Check for TypeScript errors  
✅ Test all button disable states locally  
✅ Verify error messages are user-friendly  
✅ Monitor logs for violations in first 24h  
✅ Alert if violations > 10/day  

---

## Related Docs

- [PLAN_AWARE_SUBSCRIPTION_SYSTEM.md](PLAN_AWARE_SUBSCRIPTION_SYSTEM.md) - Full implementation guide
- [EMPLOYEE_PLAN_LIMITS_TEST_SCENARIOS.md](EMPLOYEE_PLAN_LIMITS_TEST_SCENARIOS.md) - Detailed test plan
- [PRICING_REFERENCE.MD](PRICING_REFERENCE.MD) - Pricing details

---

**Need Help?** See PLAN_AWARE_SUBSCRIPTION_SYSTEM.md § 10 "Support & Troubleshooting"
