# Employee Management Plan Limits - Test Scenarios

**Test Plan for Plan-Aware Employee Restrictions**

---

## Test Environment Setup

### Prerequisites
- Admin user with workspace assigned
- Supabase/database accessible
- Browser with developer tools

### Test Users Required
```
Test Workspace 1: plan_type = 'starter' (maxEmployees: 2)
  - Admin user for testing
  
Test Workspace 2: plan_type = 'pro' (maxEmployees: 5)
  - Admin user for testing
  
Test Workspace 3: plan_type = 'enterprise' (maxEmployees: unlimited)
  - Admin user for testing
```

### Test Data
- Multiple test email addresses: test1@example.com through test10@example.com
- Valid workspace IDs and admin sessions

---

## Test Scenarios

### ✅ TS-1: Starter Plan - 0 Employees (Capacity Available)

**Setup**: Starter workspace with 0 employees

**Steps**:
1. Admin logs in to dashboard
2. Navigate to `/dashboard/[workspaceId]/employees`
3. Observe the UI

**Expected Results**:
```
✓ Page title: "👥 Employee Management"
✓ Plan info box shows: "0 of 2"
✓ Plan description: "Your Starter plan allows up to 2 employees"
✓ No "⚠ Limit Reached" warning
✓ "Invite Employee" button is ENABLED
✓ Button has normal cursor (not disabled)
✓ Click button opens invite modal
✓ Enter email: test1@example.com
✓ Submit form
✓ Modal closes
✓ Employee list updates
✓ Log entry created with level: 'info'
✓ Console shows: "Admin created invite for test1@example.com"
```

**Pass/Fail**: _______

---

### ✅ TS-2: Starter Plan - 1 Employee (Capacity Available)

**Setup**: Starter workspace with 1 employee already

**Steps**:
1. Admin logs in
2. Navigate to employees page
3. Observe UI
4. Click "Invite Employee"
5. Invite second employee

**Expected Results**:
```
✓ Plan info box shows: "1 of 2"
✓ "Invite Employee" button is ENABLED
✓ Successfully invite 2nd employee
✓ Employee count updates to 2
✓ Plan info box updates to: "2 of 2"
```

**Pass/Fail**: _______

---

### ✅ TS-3: Starter Plan - 2 Employees (At Limit)

**Setup**: Starter workspace with 2 employees (at limit)

**Steps**:
1. Admin logs in
2. Navigate to employees page
3. Observe UI
4. Try to click "Invite Employee"
5. Try to submit direct API request

**Expected Results**:
```
✓ Plan info box shows: "2 of 2"
✓ Orange warning banner displays:
  "🔒 Employee limit reached - Your Starter plan allows only 2 employee(s)..."
✓ "⚠ Limit Reached" indicator visible in info box
✓ "Invite Employee" button is DISABLED
✓ Button has opacity-50 class
✓ Button has cursor-not-allowed class
✓ Hover shows tooltip:
  "Your Starter plan allows only 2 employee(s). Upgrade to add more."
✓ Button click does nothing (handler not triggered)
✓ Direct API call: POST /api/employees/invite
  Returns: 403 Forbidden
  Response body:
  {
    "error": "Your Starter plan allows only 2 employee(s)...",
    "plan": "starter",
    "limit": 2,
    "current": 2
  }
✓ Violation logged with level: 'warn'
✓ Logs entry shows:
  message: "Employee limit violation: Attempted to invite when at limit"
  meta.reason: "plan_limit_exceeded"
```

**Pass/Fail**: _______

---

### ✅ TS-4: Pro Plan - 4 Employees (Capacity Available)

**Setup**: Pro workspace with 4 employees

**Steps**:
1. Admin logs in
2. Navigate to employees page
3. Observe UI
4. Invite 5th employee

**Expected Results**:
```
✓ Plan info box shows: "4 of 5"
✓ No warning banner
✓ "Invite Employee" button is ENABLED
✓ Successfully invite 5th employee
✓ Employee count updates to 5
✓ Plan info box updates to: "5 of 5"
✓ Warning banner appears: "Employee limit reached"
✓ Button becomes DISABLED
```

**Pass/Fail**: _______

---

### ✅ TS-5: Pro Plan - 5 Employees (At Limit)

**Setup**: Pro workspace with 5 employees (at limit)

**Steps**:
1. Admin logs in
2. Navigate to employees page
3. Attempt to invite 6th employee

**Expected Results**:
```
✓ Plan info box shows: "5 of 5"
✓ Orange warning banner visible
✓ "Invite Employee" button is DISABLED
✓ Direct API call returns 403
✓ Error: "Your Pro plan allows only 5 employee(s)..."
✓ Violation logged
```

**Pass/Fail**: _______

---

### ✅ TS-6: Enterprise Plan (Unlimited Capacity)

**Setup**: Enterprise workspace with any number of employees

**Steps**:
1. Admin logs in
2. Navigate to employees page
3. Observe UI with 0, 5, 10, 50+ employees
4. Try to invite more employees at each level

**Expected Results**:
```
At 0 employees:
✓ Plan info box shows: "0 of Unlimited"
✓ Message: "Your Enterprise plan allows unlimited employees"
✓ Button ENABLED
✓ Can invite employee

At 5 employees:
✓ Plan info box shows: "5 of Unlimited"
✓ No warning banner
✓ Button ENABLED
✓ Can invite employee

At 50 employees:
✓ Plan info box shows: "50 of Unlimited"
✓ Button ENABLED
✓ Can invite employee

✓ No limit ever reached
✓ Button never disabled
✓ No violation logs created
```

**Pass/Fail**: _______

---

### ✅ TS-7: Plan Upgrade Scenario

**Setup**: 
- Starter workspace with 2 employees (at limit)
- Workspace plan will be upgraded mid-test

**Steps**:
1. Admin logs in, navigates to employees page
2. Observe: "2 of 2", button disabled, warning visible
3. Admin upgrades plan in billing (SIMULATE: Update `workspaces.plan_type = 'pro'`)
4. Admin returns to employees page (or reloads)
5. Observe UI change
6. Try to invite 3rd employee

**Expected Results**:
```
Before upgrade:
✓ "2 of 2" displayed
✓ Button disabled
✓ Warning visible

After upgrade (same page reload):
✓ "2 of 5" displayed
✓ Button ENABLED
✓ Warning DISAPPEARS
✓ Can successfully invite 3rd employee
✓ Success message shown
✓ Employee count updates to 3
✓ No error response
```

**Pass/Fail**: _______

---

### ✅ TS-8: Downgrade Plan Scenario

**Setup**: 
- Pro workspace with 5 employees
- Plan will be downgraded to Starter

**Steps**:
1. Admin at employees page with 5 employees
2. Workspace downgraded: `plan_type = 'starter'` (UPDATE in DB or simulate)
3. Admin reloads page
4. Observe UI

**Expected Results**:
```
Before downgrade:
✓ "5 of 5" displayed
✓ Button disabled (already at Pro limit)

After downgrade (page reload):
✓ "5 of 2" displayed (OVER limit!)
✓ Button DISABLED (2 is the new limit)
✓ Warning banner shows:
  "🔒 Employee limit reached - Your Starter plan allows only 2..."
✓ Admin cannot invite more
✓ Admin must remove 3 employees to get under 2 limit
✓ After removing employees:
  - If 2 remain: Button enabled, warning disappears
  - If 1 remains: Button enabled
  - If 0 remain: Button enabled, "0 of 2" shows
```

**Pass/Fail**: _______

---

### ✅ TS-9: Concurrent Invite Attempts

**Setup**: Starter workspace with 1 employee

**Steps**:
1. Open 2 browser windows
2. Both logged in as admin to same workspace
3. Window A: Click "Invite Employee"
4. Window B: Click "Invite Employee" (quickly, before Window A submits)
5. Window A: Submit invite for test1@example.com
6. Window B: Submit invite for test2@example.com (simultaneously or soon after)

**Expected Results**:
```
Window A:
✓ Invite succeeds (201)
✓ Employee count becomes 2
✓ Data updates

Window B:
✓ Invite succeeds (201) [Race condition: if A not submitted yet]
OR
✓ Invite fails (403) [Race condition: if A submitted first]
  Error: "limit exceeded"
✓ Violation logged

Next page refresh:
✓ One of the two invites is in the database (atomicity)
✓ Employee count matches: either 2 or 3 (never 4)
```

**Pass/Fail**: _______

---

### ✅ TS-10: Non-Admin User Cannot Bypass

**Setup**: 
- Starter workspace with 2 employees
- Employee user (non-admin)

**Steps**:
1. Employee logs in
2. Try to access `/dashboard/[workspaceId]/employees`
3. Observe

**Expected Results**:
```
✓ Router redirects to /unauthorized
OR
✓ Page shows "Access Denied"
OR  
✓ Page never loads (401/403)
✓ Employee cannot see employee management
✓ Employee cannot make API calls to POST /api/employees
```

**Pass/Fail**: _______

---

### ✅ TS-11: Cross-Workspace Isolation

**Setup**: 
- Workspace A (Starter, admin user)
- Workspace B (Pro, different admin user)

**Steps**:
1. Admin A logs in, navigates to Workspace A employees page
2. Admin A somehow tries to access Workspace B URL
3. Or Admin A tries API call for Workspace B

**Expected Results**:
```
URL access: /dashboard/[workspace-B-id]/employees
✓ Redirect to /unauthorized
OR
✓ 403 Forbidden error

API call: POST /api/employees for Workspace B
✓ 403 error
✓ Error message: "Invalid admin state"
OR "Workspace mismatch"
✓ No employee is created in Workspace B
```

**Pass/Fail**: _______

---

### ✅ TS-12: Feature Gate Functions

**Setup**: React component test environment

**Steps**:
1. Test `getMaxEmployees(user)` with different users
2. Test `canAddEmployee(user, count)` with different counts
3. Test `getEmployeeLimitMessage(user, count)` messages
4. Test `getEmployeeLockReason(user, count)` reasons

**Expected Results**:

```typescript
// Starter user (maxEmployees: 2)
const starterUser = { 
  plan_type: 'starter',
  plan_limits: { maxEmployees: 2 }
};

getMaxEmployees(starterUser) 
  ✓ Returns: 2

canAddEmployee(starterUser, 0) 
  ✓ Returns: true

canAddEmployee(starterUser, 1) 
  ✓ Returns: true

canAddEmployee(starterUser, 2) 
  ✓ Returns: false

getEmployeeLimitMessage(starterUser, 1)
  ✓ Returns: "1 of 2 employees used"

getEmployeeLimitMessage(starterUser, 2)
  ✓ Returns: "Your Starter plan allows only 2 employee(s)..."

// Pro user (maxEmployees: 5)
const proUser = {
  plan_type: 'pro',
  plan_limits: { maxEmployees: 5 }
};

getMaxEmployees(proUser)
  ✓ Returns: 5

canAddEmployee(proUser, 4)
  ✓ Returns: true

canAddEmployee(proUser, 5)
  ✓ Returns: false

// Enterprise user (maxEmployees: -1)
const enterpriseUser = {
  plan_type: 'enterprise',
  plan_limits: { maxEmployees: -1 }
};

getMaxEmployees(enterpriseUser)
  ✓ Returns: -1

canAddEmployee(enterpriseUser, 100)
  ✓ Returns: true

getEmployeeLimitMessage(enterpriseUser, 50)
  ✓ Returns: "Unlimited employees"
```

**Pass/Fail**: _______

---

### ✅ TS-13: Error Response Format

**Setup**: Starter workspace at limit, direct API testing

**Steps**:
1. Make direct POST to /api/employees/invite with workspace at 2 employees
2. Examine response body and status code

**Expected Results**:
```
Status Code: 403 Forbidden

Response Body:
{
  "error": "Your Starter plan allows only 2 employee(s). You currently have 2. Upgrade to add more.",
  "plan": "starter",
  "limit": 2,
  "current": 2
}

✓ All fields present
✓ Error message is user-friendly
✓ Plan, limit, current values are accurate
✓ Frontend can extract limit info from response
```

**Pass/Fail**: _______

---

### ✅ TS-14: Audit Logging

**Setup**: Starter workspace, attempt to invite at limit

**Steps**:
1. Starter workspace with 2 employees
2. Attempt to invite 3rd employee (both UI and API)
3. Query logs table
4. Examine entries

**Expected Results**:
```sql
SELECT * FROM logs 
WHERE workspace_id = 'starter-ws-id'
ORDER BY created_at DESC;

First entry (violation):
✓ level = 'warn'
✓ message contains 'Employee limit violation'
✓ meta.reason = 'plan_limit_exceeded'
✓ meta.plan_type = 'starter'
✓ meta.max_employees = 2
✓ meta.current_employees = 2
✓ meta.workspace_id = 'starter-ws-id'
✓ meta.invitee_email = 'test@example.com'

Check another scenario (success):
✓ level = 'info'
✓ message contains 'Created employee invite'
✓ meta.plan_type = 'starter'
✓ meta.current_employees = 1 (before adding)
✓ meta.max_employees = 2
✓ meta.invitee_email = 'test@example.com'
```

**Pass/Fail**: _______

---

### ✅ TS-15: Mobile Responsiveness

**Setup**: Starter workspace with employees

**Steps**:
1. Open employees page on mobile device (or use browser dev tools)
2. Viewport size: 375px wide (iPhone)
3. Observe UI elements

**Expected Results**:
```
Mobile (375px):
✓ "Invite Employee" button visible and clickable
✓ Plan info box stacks properly
✓ Warning banner readable
✓ Button disable state visible
✓ Employee count visible
✓ No horizontal scroll needed
✓ Touch-friendly button size (>44px height)

Tablet (768px):
✓ All elements properly sized
✓ Grid layout adjusts correctly
✓ No layout shift when button disabled

Desktop (1200px):
✓ Full layout with stats footer
✓ All columns visible
✓ Proper spacing
```

**Pass/Fail**: _______

---

## Test Results Summary

| Test ID | Scenario | Result | Notes |
|---------|----------|--------|-------|
| TS-1 | Starter - 0 employees | ✓ PASS / ❌ FAIL | _____ |
| TS-2 | Starter - 1 employee | ✓ PASS / ❌ FAIL | _____ |
| TS-3 | Starter - 2 employees | ✓ PASS / ❌ FAIL | _____ |
| TS-4 | Pro - 4 employees | ✓ PASS / ❌ FAIL | _____ |
| TS-5 | Pro - 5 employees | ✓ PASS / ❌ FAIL | _____ |
| TS-6 | Enterprise - unlimited | ✓ PASS / ❌ FAIL | _____ |
| TS-7 | Plan upgrade | ✓ PASS / ❌ FAIL | _____ |
| TS-8 | Plan downgrade | ✓ PASS / ❌ FAIL | _____ |
| TS-9 | Concurrent requests | ✓ PASS / ❌ FAIL | _____ |
| TS-10 | Non-admin access | ✓ PASS / ❌ FAIL | _____ |
| TS-11 | Cross-workspace | ✓ PASS / ❌ FAIL | _____ |
| TS-12 | Feature gates | ✓ PASS / ❌ FAIL | _____ |
| TS-13 | Error response | ✓ PASS / ❌ FAIL | _____ |
| TS-14 | Audit logging | ✓ PASS / ❌ FAIL | _____ |
| TS-15 | Mobile UI | ✓ PASS / ❌ FAIL | _____ |

**Overall Result**: ___________

**Sign-off**: _________________ Date: _______

---

## Test Notes

### Known Issues/Limitations
- [ ] None identified

### Recommendations for Future Tests
- [ ] Load testing: 1000+ employees in Enterprise workspace
- [ ] Performance: Time to check limits with large employee list
- [ ] Integration: Payment system upgrades plan in real-time

---

**Test Plan Created**: January 17, 2026  
**Status**: Ready for Testing  
**Coverage**: 15 comprehensive scenarios
