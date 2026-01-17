# Employee Management Plan Limits - Quick Reference Guide

**Quick Reference for: Adding Employee Limit Enforcement**

---

## 📋 Implementation Summary

| Component | Location | Changes |
|-----------|----------|---------|
| Plan Limits | `app/lib/db/index.ts` | Added `maxEmployees` to PLAN_LIMITS |
| Feature Gates | `app/lib/feature-gates.ts` | 5 new functions for employee limits |
| API Endpoint | `app/api/employees/route.ts` | Plan check in POST handler (403 if exceeded) |
| Frontend | `app/dashboard/[workspaceId]/employees/page.tsx` | UI limits, button disable, warning banner |

---

## 🔑 Key Functions

### Feature Gate Functions (Use in React Components)

```typescript
import { getMaxEmployees, canAddEmployee, getEmployeeLimitMessage } from '@/lib/feature-gates';

// Get max allowed employees for a user
const maxEmployees = getMaxEmployees(user);  // Returns: 2, 5, or -1 (unlimited)

// Check if user can add more employees
const canAdd = canAddEmployee(user, currentCount);  // Returns: boolean

// Get user-friendly message
const message = getEmployeeLimitMessage(user, currentCount);
// Returns: "2 of 5 employees used" or "Limit reached"
```

### Backend Validation (Already in API Route)

```typescript
// Automatic in POST /api/employees/invite
// Check happens automatically, returns 403 if exceeded
// No additional code needed - it's already implemented
```

---

## 📊 Plan Limits by Tier

| Plan | Max Employees | Max Pages | Instagram |
|------|---------------|-----------|-----------|
| Starter | **2** | 1 | ❌ |
| Pro | **5** | 3 | ✅ |
| Enterprise | **Unlimited** | Unlimited | ✅ |

---

## 🎯 Frontend Implementation (Done)

### Display Current Usage
```tsx
<p>Employee Limit: <span className="font-bold">2</span> of <span className="font-bold">5</span></p>
```

### Disable Button When at Limit
```tsx
<button
  disabled={
    userAccess?.plan_limits?.maxEmployees !== -1 &&
    employees.length >= (userAccess?.plan_limits?.maxEmployees || 2)
  }
>
  Invite Employee
</button>
```

### Show Warning Banner
```tsx
{employees.length >= (userAccess?.plan_limits?.maxEmployees || 2) && (
  <div className="bg-orange-50 border border-orange-200">
    🔒 Employee limit reached - Upgrade to add more
  </div>
)}
```

---

## 🔒 Backend Enforcement (Done)

### Error Response When Limit Exceeded
```json
{
  "error": "Your Pro plan allows only 5 employee(s). You currently have 5. Upgrade to add more.",
  "plan": "pro",
  "limit": 5,
  "current": 5
}
```

**Status**: `403 Forbidden`

### Violation Logging
```typescript
// Automatically logged with:
{
  level: 'warn',
  message: 'Employee limit violation: Attempted to invite when at limit',
  meta: {
    reason: 'plan_limit_exceeded',
    plan_type: 'pro',
    max_employees: 5,
    current_employees: 5
  }
}
```

---

## ✅ Testing Checklist

### Unit Tests
- [ ] `getMaxEmployees()` returns correct values
- [ ] `canAddEmployee()` returns true/false correctly
- [ ] `getEmployeeLimitMessage()` formats messages correctly

### Integration Tests
- [ ] POST /api/employees/invite returns 403 when at limit
- [ ] Violation logged to database
- [ ] Success logged to database

### E2E Tests
- [ ] Starter user can invite 2 employees
- [ ] Starter user cannot invite 3rd employee
- [ ] Button disabled at limit
- [ ] Pro user can invite up to 5 employees
- [ ] Enterprise user can invite unlimited employees

### Manual Testing
1. **Starter Plan - At Limit (2)**
   - [ ] See "2 of 2 employees used"
   - [ ] Orange warning banner visible
   - [ ] "Invite Employee" button disabled
   - [ ] Hover shows tooltip about limit

2. **Pro Plan - Under Limit (3 of 5)**
   - [ ] See "3 of 5 employees used"
   - [ ] No warning banner
   - [ ] "Invite Employee" button enabled
   - [ ] Can successfully invite 4th employee

3. **Enterprise Plan - No Limit**
   - [ ] See "X of Unlimited employees"
   - [ ] Button always enabled
   - [ ] No warning banner
   - [ ] Can invite unlimited

4. **Upgrade Scenario**
   - [ ] User at Starter limit (2 employees)
   - [ ] Upgrade to Pro plan
   - [ ] Page reloaded
   - [ ] Button becomes enabled
   - [ ] Can invite 3rd employee

---

## 🐛 Debugging

### Check Current Employee Count
```bash
# In browser console
const response = await fetch('/api/employees');
const data = await response.json();
console.log('Employees:', data.employees.length);
```

### Check Plan Limits
```bash
# In browser console
const response = await fetch('/api/auth/me');
const data = await response.json();
console.log('Plan limits:', data.user.plan_limits);
```

### Check Violation Logs
```sql
SELECT * FROM logs 
WHERE message LIKE '%Employee limit%'
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Current Plan
```sql
SELECT id, plan_type FROM workspaces 
WHERE id = 'workspace-uuid';
```

---

## 🔄 Error Scenarios

### Button Disabled But User Tries Direct API Call
**Cause**: User using browser dev tools to bypass button disable  
**Response**: API returns 403 with error message  
**Logged**: Yes, violation logged as `level: 'warn'`

### API Returns Success (201) But Shouldn't
**Cause**: Plan limit check failed or data race condition  
**Solution**: Check `logs` table for errors  
**Monitoring**: Alert if limit violations exceed threshold

### Plan Changed But Old UI Still Shows Old Limit
**Cause**: Browser cache or page not reloaded  
**Solution**: Page reload refreshes user data  
**Monitoring**: Set cache expiry appropriately

---

## 📈 Monitoring Queries

### Violations Per Day
```sql
SELECT DATE(created_at) as day, COUNT(*) as violations
FROM logs
WHERE level = 'warn' AND message LIKE '%limit violation%'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

### Users at Plan Limit
```sql
SELECT w.id, w.plan_type, COUNT(e.id) as employees, p.maxEmployees
FROM workspaces w
LEFT JOIN employees e ON e.workspace_id = w.id
LEFT JOIN (
  SELECT 'starter' as plan, 2 as maxEmployees
  UNION SELECT 'pro', 5
  UNION SELECT 'enterprise', 999
) p ON p.plan = w.plan_type
GROUP BY w.id, w.plan_type
HAVING COUNT(e.id) >= p.maxEmployees
ORDER BY employees DESC;
```

### Successful Invites by Plan
```sql
SELECT 
  w.plan_type,
  COUNT(*) as invites
FROM logs l
JOIN workspaces w ON l.meta->>'workspace_id' = w.id
WHERE l.level = 'info' AND l.message LIKE '%Created employee invite%'
  AND l.created_at > NOW() - INTERVAL 30 DAYS
GROUP BY w.plan_type
ORDER BY invites DESC;
```

---

## 🚀 Deployment Steps

1. **Deploy Code** (Already done)
   - All files committed and merged
   - TypeScript compiles without errors

2. **No Migration Needed**
   - Uses existing `workspaces.plan_type` column
   - Uses existing `employees` table
   - No schema changes required

3. **Monitor First 24 Hours**
   - Check logs for violations
   - Monitor error rates
   - Verify button disable works

4. **Alert Configuration**
   - Alert if violations > 10/day (sign of UX issue)
   - Alert if API errors > 1%
   - Alert if feature gate functions return errors

---

## 🔗 Related Documentation

- [EMPLOYEE_MANAGEMENT_PLAN_LIMITS.md](EMPLOYEE_MANAGEMENT_PLAN_LIMITS.md) - Complete implementation guide
- [EMPLOYEE_API_IMPLEMENTATION.md](EMPLOYEE_API_IMPLEMENTATION.md) - Employee system overview
- [EMPLOYEE_MANAGEMENT_BUILD_SUMMARY.md](EMPLOYEE_MANAGEMENT_BUILD_SUMMARY.md) - Original employee build

---

## 💡 Common Questions

**Q: How do I check if a user can add employees?**
A: Use `canAddEmployee(user, currentCount)` from feature-gates

**Q: What if someone makes a direct API call to bypass the button?**
A: API enforces the limit and returns 403. Violation is logged.

**Q: How do I disable this feature?**
A: Comment out the limit check in `POST /api/employees/route.ts` lines 155-180

**Q: Can I change the limits per user?**
A: Not yet. Currently, limits are per plan type. Contact for custom limits.

**Q: What happens after upgrade to higher plan?**
A: New limits apply immediately. UI updates after page refresh.

---

**Last Updated**: January 17, 2026  
**Status**: ✅ Production Ready  
**Maintenance**: Low (no moving parts)
