# Plan-Aware Subscription System - Test Scenarios

**Status**: Production Ready | **Version**: 1.0 | **Date**: January 17, 2026

**Total Scenarios**: 20  
**Coverage**: Employee limits, account limits, AI tokens, UI states, edge cases

---

## Test Results Tracking

| # | Scenario | Expected | Result | Status | Notes |
|---|----------|----------|--------|--------|-------|
| TE-1 | Starter: Add 1st employee | 201 ✅ | | ⬜ | |
| TE-2 | Starter: Add 2nd employee | 201 ✅ | | ⬜ | |
| TE-3 | Starter: Add 3rd employee | 403 ❌ | | ⬜ | |
| TE-4 | Pro: Add 4-5 employees | 201 ✅ | | ⬜ | |
| TE-5 | Pro: Add 6th employee | 403 ❌ | | ⬜ | |
| TA-1 | Starter: Connect 1st account | 201 ✅ | | ⬜ | |
| TA-2 | Starter: Connect 2nd account | 403 ❌ | | ⬜ | |
| TA-3 | Pro: Connect 1-3 accounts | 201 ✅ | | ⬜ | |
| TA-4 | Pro: Connect 4th account | 403 ❌ | | ⬜ | |
| TA-5 | Advanced: Unlimited accounts | 201 ✅ | | ⬜ | |
| TAI-1 | Starter: Use 5K tokens (2K remain) | 200 ✅ | | ⬜ | |
| TAI-2 | Starter: Use 10K tokens (2K remain) | 403 ❌ | | ⬜ | |
| TAI-3 | Pro: Use 25K tokens (25K remain) | 200 ✅ | | ⬜ | |
| TUI-1 | Starter at limit: Button disabled | Disabled | | ⬜ | |
| TUI-2 | Pro below limit: Button enabled | Enabled | | ⬜ | |
| TUI-3 | Free user: All buttons disabled | Disabled | | ⬜ | |
| TUP-1 | Upgrade Starter → Pro | Limits update | | ⬜ | |
| TDN-1 | Downgrade Pro → Starter | Over limit | | ⬜ | |
| TLG-1 | Verify audit logging | Logged | | ⬜ | |
| TMB-1 | Mobile responsiveness | Responsive | | ⬜ | |

---

## EMPLOYEE LIMIT TESTS (TE)

### TE-1: Starter Plan - Add 1st Employee (Success)

**Setup**:
- User on Starter plan (max 2 employees)
- Current state: 0 employees in workspace
- User role: Admin

**Steps**:
1. Navigate to `/dashboard/[workspaceId]/employees`
2. Click "Invite Employee" button
3. Enter email: `employee1@example.com`
4. Submit form

**Expected Result**:
- ✅ Status: 201 Created
- ✅ Toast: "Invite sent to employee1@example.com"
- ✅ Button: Still enabled
- ✅ Message: "1 of 2 employees used"

**Pass/Fail**: ⬜

---

### TE-2: Starter Plan - Add 2nd Employee (Success)

**Setup**:
- User on Starter plan (max 2 employees)
- Current state: 1 employee in workspace
- User role: Admin

**Steps**:
1. Navigate to employees page
2. Click "Invite Employee" button
3. Enter email: `employee2@example.com`
4. Submit form

**Expected Result**:
- ✅ Status: 201 Created
- ✅ Toast: "Invite sent to employee2@example.com"
- ✅ Button: Now disabled (at limit)
- ✅ Message: "2 of 2 employees used"
- ✅ Banner: "⚠️ Employee limit reached"

**Pass/Fail**: ⬜

---

### TE-3: Starter Plan - Add 3rd Employee (Failure)

**Setup**:
- User on Starter plan (max 2 employees)
- Current state: 2 employees in workspace (at limit)
- User role: Admin

**Steps**:
1. Navigate to employees page
2. Observe "Invite Employee" button
3. Hover over button to see tooltip
4. Attempt API call (if button manually disabled):
   ```bash
   curl -X POST /api/employees/invite \
     -H "Content-Type: application/json" \
     -d '{"email":"employee3@example.com"}'
   ```

**Expected Result**:
- ✅ Button: Disabled (opacity-50)
- ✅ Tooltip: "You've reached your Starter plan limit. Upgrade to add more."
- ✅ Message: "2 of 2 employees used"
- ✅ Banner: Orange warning shown
- ✅ API Status: 403 Forbidden
- ✅ API Response: 
  ```json
  {
    "error": "Your Starter plan allows only 2 employee(s). You currently have 2. Upgrade to add more.",
    "plan": "starter",
    "limit": 2,
    "current": 2
  }
  ```
- ✅ Logging: Violation logged to `logs` table
  ```sql
  WHERE message LIKE '%Employee limit violation%'
  ```

**Pass/Fail**: ⬜

---

### TE-4: Pro Plan - Add 4th & 5th Employees (Success)

**Setup**:
- User on Pro plan (max 5 employees)
- Current state: 3 employees
- User role: Admin

**Steps**:
1. Add 4th employee
2. Add 5th employee

**Expected Result Each**:
- ✅ Status: 201 Created
- ✅ Message updates: "4 of 5" → "5 of 5"
- ✅ After 5th: Button disabled, banner shown

**Pass/Fail**: ⬜

---

### TE-5: Pro Plan - Add 6th Employee (Failure)

**Setup**:
- User on Pro plan (max 5 employees)
- Current state: 5 employees (at limit)
- User role: Admin

**Steps**:
1. View employees page
2. Observe button state
3. Attempt to add 6th employee

**Expected Result**:
- ✅ Button: Disabled
- ✅ API: 403 Forbidden
- ✅ Error: "Your Pro plan allows only 5 employee(s)..."

**Pass/Fail**: ⬜

---

## ACCOUNT CONNECTION TESTS (TA)

### TA-1: Starter Plan - Connect 1st Account (Success)

**Setup**:
- User on Starter plan (max 1 account)
- Current state: 0 accounts connected
- User role: Admin

**Steps**:
1. Navigate to `/dashboard/integrations`
2. Observe plan capacity message
3. Click "Connect Facebook" button
4. Complete OAuth flow
5. Return with pages
6. Select 1 page
7. Click "Connect 1 Page(s)"

**Expected Result**:
- ✅ Plan capacity message: "0 of 1 accounts connected"
- ✅ Button: Enabled (blue)
- ✅ OAuth: Redirects to Facebook login
- ✅ Page selection: Shows pages
- ✅ Connection: 201 Created
- ✅ Toast: "Connected 1 page(s) successfully!"
- ✅ UI updates: "1 of 1 accounts connected"
- ✅ Button: Now disabled

**Pass/Fail**: ⬜

---

### TA-2: Starter Plan - Connect 2nd Account (Failure)

**Setup**:
- User on Starter plan (max 1 account)
- Current state: 1 account connected (Facebook)
- User role: Admin

**Steps**:
1. Navigate to integrations page
2. Observe button states
3. Try to connect Instagram
4. Or try to connect another Facebook page

**Expected Result**:
- ✅ Message: "1 of 1 accounts connected"
- ✅ Both buttons: Disabled
- ✅ Badge on both: "⚠️ Limit reached"
- ✅ Tooltip: "You've reached your Starter plan limit"
- ✅ If API called: 403 Forbidden
- ✅ Error: "Starter plan allows only one account"
- ✅ Logging: Violation recorded

**Pass/Fail**: ⬜

---

### TA-3: Pro Plan - Connect 1-3 Accounts (Success)

**Setup**:
- User on Pro plan (max 3 accounts)
- Current state: 0 accounts
- User role: Admin

**Steps**:
1. Connect 1st account (Facebook page)
   - Message: "1 of 3 accounts connected"
   - Button: Enabled
2. Connect 2nd account (different Facebook page)
   - Message: "2 of 3 accounts connected"
   - Button: Enabled
3. Connect 3rd account (Instagram)
   - Message: "3 of 3 accounts connected"
   - Button: Disabled

**Expected Result After Each**:
- ✅ Status: 201 Created
- ✅ Message updates accurately
- ✅ Button disabled on 3rd connection
- ✅ Audit logs each connection

**Pass/Fail**: ⬜

---

### TA-4: Pro Plan - Connect 4th Account (Failure)

**Setup**:
- User on Pro plan (max 3 accounts)
- Current state: 3 accounts (at limit)
- User role: Admin

**Steps**:
1. View integrations page
2. Attempt to connect 4th account
3. Try OAuth flow

**Expected Result**:
- ✅ Button: Disabled
- ✅ Tooltip: "You've reached your Pro plan limit"
- ✅ If API called: 403 Forbidden
- ✅ Error: "You can only add 0 more page(s)"
- ✅ No OAuth redirect

**Pass/Fail**: ⬜

---

### TA-5: Advanced Plan - Unlimited Accounts (Success)

**Setup**:
- User on Advanced plan (unlimited accounts)
- Current state: 0 accounts
- User role: Admin

**Steps**:
1. Connect multiple accounts (10+)
2. Repeat OAuth flow

**Expected Result**:
- ✅ Message: "Unlimited account connections"
- ✅ Button: Always enabled
- ✅ All connections: 201 Created
- ✅ No limit warnings

**Pass/Fail**: ⬜

---

## AI TOKEN LIMIT TESTS (TAI)

### TAI-1: Starter Plan - Use 5K Tokens (Success)

**Setup**:
- User on Starter plan (10K tokens/month)
- Current usage: 2K tokens
- Remaining: 8K tokens
- User role: Any

**Steps**:
1. Make API call to validate tokens:
   ```bash
   curl -X POST /api/ai/validate-tokens \
     -H "Content-Type: application/json" \
     -d '{"requestedTokens": 5000, "action": "ai_response"}'
   ```

**Expected Result**:
- ✅ Status: 200 OK
- ✅ Response:
  ```json
  {
    "allowed": true,
    "plan": "starter",
    "planName": "Starter",
    "tokenLimit": 10000,
    "used": 2000,
    "remaining": 8000,
    "message": "8,000 tokens available"
  }
  ```
- ✅ AI action: Proceeds

**Pass/Fail**: ⬜

---

### TAI-2: Starter Plan - Use 10K Tokens (Failure)

**Setup**:
- User on Starter plan (10K tokens/month)
- Current usage: 8K tokens
- Remaining: 2K tokens
- Requested: 5K tokens
- User role: Any

**Steps**:
1. Make API call:
   ```bash
   curl -X POST /api/ai/validate-tokens \
     -H "Content-Type: application/json" \
     -d '{"requestedTokens": 5000}'
   ```

**Expected Result**:
- ✅ Status: 403 Forbidden
- ✅ Response:
  ```json
  {
    "allowed": false,
    "plan": "starter",
    "error": "Insufficient AI tokens. You have 2,000 tokens remaining. This action requires 5,000 tokens. Upgrade to Pro plan for more tokens.",
    "remaining": 2000,
    "requested": 5000
  }
  ```
- ✅ AI action: Blocked
- ✅ Logging: Violation recorded

**Pass/Fail**: ⬜

---

### TAI-3: Pro Plan - Use 25K Tokens (Success)

**Setup**:
- User on Pro plan (50K tokens/month)
- Current usage: 25K tokens
- Remaining: 25K tokens
- Requested: 10K tokens
- User role: Any

**Steps**:
1. Make API call

**Expected Result**:
- ✅ Status: 200 OK
- ✅ allowed: true
- ✅ remaining: 25000
- ✅ message: "25% of monthly AI tokens used (25,000 of 50,000)"

**Pass/Fail**: ⬜

---

## UI STATE TESTS (TUI)

### TUI-1: Starter at Limit - Button Disabled

**Setup**:
- User on Starter plan
- At capacity (1/1 accounts or 2/2 employees)
- Viewing integrations page

**Steps**:
1. Inspect button state
2. Hover over button
3. Check for badges

**Expected Result**:
- ✅ Button: Disabled (opacity-50, cursor-not-allowed)
- ✅ Tooltip: Shows upgrade message
- ✅ Badge: "⚠️ Limit reached"
- ✅ Message: "1 of 1 accounts connected"
- ✅ Background: Muted (gray-800/50)

**Pass/Fail**: ⬜

---

### TUI-2: Pro Below Limit - Button Enabled

**Setup**:
- User on Pro plan
- Below capacity (2/3 accounts or 3/5 employees)
- Viewing integrations page

**Steps**:
1. Inspect button state
2. Check message

**Expected Result**:
- ✅ Button: Enabled (blue, interactive)
- ✅ Badge: None
- ✅ Message: "2 of 3 accounts connected"
- ✅ Background: Normal (bg-gray-800)

**Pass/Fail**: ⬜

---

### TUI-3: Free User - All Buttons Disabled

**Setup**:
- User on Free plan (not subscribed)
- Viewing integrations page

**Steps**:
1. View integrations page
2. Check all buttons

**Expected Result**:
- ✅ Facebook button: Disabled
  - Badge: "🔒 Paid only"
  - Tooltip: "Upgrade to a paid plan"
- ✅ Instagram button: Disabled
  - Badge: "🔒 Pro plan required"
- ✅ Background: Muted (opacity-60)

**Pass/Fail**: ⬜

---

## PLAN CHANGE TESTS (TUP/TDN)

### TUP-1: Upgrade Starter → Pro

**Setup**:
- User on Starter plan (2 employees, 1 account)
- At current limit in both

**Steps**:
1. Edit user's plan in DB to 'pro'
   ```sql
   UPDATE users SET plan_type = 'pro' WHERE id = '...';
   ```
2. Refresh dashboard
3. Check capacity

**Expected Result**:
- ✅ Message updates: "2 of 5 employees" (from "2 of 2")
- ✅ Button: Re-enabled
- ✅ Can now add 3 more employees
- ✅ Can connect 2 more accounts
- ✅ Instagram button: Now enabled

**Pass/Fail**: ⬜

---

### TDN-1: Downgrade Pro → Starter

**Setup**:
- User on Pro plan with 3 accounts connected (3/3)
- Downgrade to Starter

**Steps**:
1. Edit plan to 'starter'
2. Refresh dashboard
3. Check capacity

**Expected Result**:
- ✅ Current state: 3 accounts connected
- ✅ New limit: 1 account
- ✅ UI shows: "⚠️ Over plan limit"
- ✅ Message: "You have 3 accounts but Starter allows only 1"
- ✅ Button: Disabled
- ✅ Banner: Warning message
- ✅ Can disconnect accounts until at 1

**Pass/Fail**: ⬜

---

## LOGGING TESTS (TLG)

### TLG-1: Audit Logging - Violations & Success

**Setup**:
- Set up monitoring
- Perform employee/account violations
- Perform successful actions

**Steps**:
1. Add employee - success
2. Try to exceed limit - violation
3. Check logs table

**Expected Result**:
- ✅ Success logged:
  ```sql
  SELECT * FROM logs WHERE level = 'info' 
  AND message LIKE '%Created employee invite%'
  ORDER BY created_at DESC LIMIT 1;
  ```
- ✅ Violation logged:
  ```sql
  SELECT * FROM logs WHERE level = 'warn' 
  AND message LIKE '%limit violation%'
  ORDER BY created_at DESC LIMIT 1;
  ```
- ✅ Both have `meta` with plan info
- ✅ Metadata includes: plan_type, limits, current count

**Pass/Fail**: ⬜

---

## MOBILE RESPONSIVENESS TESTS (TMB)

### TMB-1: Mobile - Account Limits Display

**Setup**:
- Open on mobile (iPhone 12, Galaxy S20)
- User on Starter plan (1/1 accounts)

**Steps**:
1. Navigate to integrations
2. Inspect plan capacity info box
3. Check button sizes
4. Check badges and text

**Expected Result**:
- ✅ Info box: Displays cleanly
- ✅ Button: Touch-friendly size (48px min)
- ✅ Badge: Readable text
- ✅ Tooltips: Show on tap
- ✅ Layout: No horizontal scroll

**Pass/Fail**: ⬜

---

## EDGE CASES

### EC-1: Concurrent Invite Attempts

**Setup**:
- Starter user at limit (2/2)
- Two invites submitted simultaneously

**Steps**:
1. Submit invite 1
2. Immediately submit invite 2
3. Check responses

**Expected Result**:
- ✅ First: 201 Created
- ✅ Second: 403 Forbidden (limit check passes after first increments count)
- ✅ Exactly 1 employee added (not 2)
- ✅ No database constraint violations

**Pass/Fail**: ⬜

---

### EC-2: Plan Change During Session

**Setup**:
- User on Starter with session open
- Admin upgrades plan in DB
- User continues without refresh

**Steps**:
1. Load integrations page
2. Admin upgrades plan in DB
3. User tries to connect account
4. User refreshes
5. Check UI update

**Expected Result**:
- ✅ Before refresh: Uses cached limits (1 account max)
- ✅ After refresh: Uses updated limits (3 accounts max)
- ✅ API call: Uses current plan (will succeed on 4th account now)

**Pass/Fail**: ⬜

---

### EC-3: API Call Without UI Check

**Setup**:
- Starter user at limit
- Frontend disabled button (cannot be clicked)

**Steps**:
1. Open browser console
2. Call API directly:
   ```javascript
   fetch('/api/employees/invite', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email: 'test@example.com' })
   })
   ```

**Expected Result**:
- ✅ Backend still enforces: 403 Forbidden
- ✅ Error message returned
- ✅ Violation logged
- ✅ No employee created

**Pass/Fail**: ⬜

---

## Test Summary

**Total Scenarios**: 20  
**Employee Tests**: 5 (TE-1 to TE-5)  
**Account Tests**: 5 (TA-1 to TA-5)  
**AI Token Tests**: 3 (TAI-1 to TAI-3)  
**UI Tests**: 3 (TUI-1 to TUI-3)  
**Plan Change Tests**: 2 (TUP-1, TDN-1)  
**Logging Tests**: 1 (TLG-1)  
**Mobile Tests**: 1 (TMB-1)  

**Passing**: ⬜ / 20  
**Date Tested**: _________  
**Tester**: _________  

---

## Test Notes

**Critical Path**:
1. TE-3 (Employee limit rejection)
2. TA-2 (Account limit rejection)
3. TAI-2 (Token limit rejection)
4. TUI-1 (Button disabled state)
5. EC-3 (Backend enforcement without UI)

**Common Issues**:
- Buttons still enabled after reaching limit → Check `canConnectAccount()` logic
- Limits not updating after plan change → Check session/auth refresh
- No error message → Check API response parsing
- Logs not recording → Check Supabase RLS policies

---

## Sign-Off

| Role | Name | Date | Sign |
|------|------|------|------|
| QA Lead | | | |
| Dev Lead | | | |
| Product | | | |

---

**Related**: [PLAN_AWARE_SUBSCRIPTION_SYSTEM.md](PLAN_AWARE_SUBSCRIPTION_SYSTEM.md) | [PLAN_AWARE_SUBSCRIPTION_QUICK_REF.md](PLAN_AWARE_SUBSCRIPTION_QUICK_REF.md)
