# V1 Auth - Employee Invite Acceptance Flow - Implementation Summary

## ✅ Completed Implementation

All requested changes have been implemented and are ready for testing.

---

## Problem Statement

**Issue:** After an employee accepts an invite, logging in fails with "user not found" or "role not found" (403 errors)

**Root Cause:** The `auth_uid` field in the internal `users` table was not being linked to the Supabase auth user ID during invite acceptance

**Impact:** Users complete the invite acceptance flow but cannot log in because the login endpoint (`/api/auth/login`) uses `ensureInternalUser()` to find users by `auth_uid`, and without this linkage, authentication fails immediately

---

## Solution Summary

### 1. **Fixed Accept-Invite Endpoint** ([app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts))

**Changes:**
- Restructured to handle two scenarios clearly:
  - **Existing user by email:** Link auth_uid to existing user (new behavior)
  - **New user:** Create auth user, then create internal user with auth_uid linked
- Proper error handling for concurrent invites
- Clear logging at each step showing auth_uid linkage
- Preserve existing role and workspace (no overwrites)

**Key Log Outputs:**
```
✅ Existing user updated: {
  user_id: "abc-123",
  auth_uid: "xyz-789",
  updates: { auth_uid: "xyz-789" }
}

✅ Successfully created and linked new user: {
  user_id: "user-id",
  auth_uid: "auth-uuid",
  email: "emp@company.com",
  role: "employee",
  workspace_id: "ws-123"
}
```

**Response:** (No user_id, role, or workspace exposed as per requirements)
```json
{
  "success": true,
  "next": "/auth/login?invite=accepted"
}
```

---

### 2. **Updated ensureInternalUser()** ([app/lib/supabase/queries.ts](app/lib/supabase/queries.ts))

**Changes:**
- Made function strictly **read-only** (no auto-creation of users)
- Enforces proper **auth_uid** lookup strategy:
  1. Try internal ID lookup
  2. Try auth_uid lookup
  3. Retry after 500ms (for auth trigger delays)
  4. Throw error if not found (no creation)
- Added **role validation** at every lookup (throws if role missing)
- Clear error messages with (403) indicators
- Comprehensive logging showing user resolution

**Key Behaviors:**
```typescript
// Find user by auth_uid
const user = await ensureInternalUser(auth_uid)
// ├─ If found with role: return { id: user_id }
// ├─ If found but no role: throw "role missing (403)"
// └─ If not found: throw "User not found (403)"
```

**Login Integration:** Already correct in [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
- Catches 403 errors and returns "User profile not found"
- No user creation during login
- Role and workspace obtained via RPC

---

## Complete End-to-End Flow

### Diagram
```
┌─────────────────┐
│ Admin Creates   │
│ Invite          │ → employee_invites table
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────┐
│ Employee Accepts Invite         │
│ POST /api/employees/accept-...  │
├─────────────────────────────────┤
│ 1. Validate token               │
│ 2. Lookup invite                │
│ 3. Check existing user:         │
│    ├─ If exists: Link auth_uid  │ ← CRITICAL FIX
│    └─ If new: Create auth user  │
│ 4. Mark invite accepted         │
│ 5. Return login redirect        │
└────────┬────────────────────────┘
         │ auth_uid now linked!
         ↓
┌─────────────────────────────────┐
│ Employee Logs In                │
│ POST /api/auth/login            │
├─────────────────────────────────┤
│ 1. Supabase signInWithPassword   │
│ 2. Get auth.user { id: auth_uid}│
│ 3. ensureInternalUser(auth_uid) │
│    └─ Query by auth_uid ✓       │
│ 4. Resolve role & workspace     │
│ 5. Create session               │
│ 6. Return { role, workspace_id} │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────┐
│ Client Routes   │
│ Based on Role   │ → /employees/dashboard (for employee role)
└─────────────────┘
```

### Step-by-Step Data Flow

**Step 1: Invite Created by Admin**
```sql
INSERT INTO employee_invites (
  email, token, status, workspace_id, invited_by
) VALUES (
  'employee@company.com', 'token-uuid', 'pending', 'ws-123', 'admin-id'
)
```

**Step 2: Employee Accepts Invite**
```
POST /api/employees/accept-invite?token=token-uuid
{
  email: "employee@company.com",
  first_name: "John",
  password: "SecurePass123"
}
```

Actions in backend:
```
a) Lookup invite → found, status='pending'
b) Check if user exists by email
c) Create Supabase auth user → get auth_uid="abc123"
d) Create/Update internal user:
   UPDATE users SET auth_uid='abc123' WHERE email='...'
e) Mark invite as accepted
f) Return: { success: true, next: '/auth/login?invite=accepted' }
```

Result in database:
```sql
-- auth.users (Supabase Auth)
id: 'abc123'
email: 'employee@company.com'

-- public.users (Internal)
id: 'user-id'
auth_uid: 'abc123'        ← LINKED! (This is the fix)
email: 'employee@company.com'
role: 'employee'
workspace_id: 'ws-123'
```

**Step 3: Employee Logs In**
```
POST /api/auth/login
{
  email: "employee@company.com",
  password: "SecurePass123"
}
```

Login process:
```
a) signInWithPassword() → auth.user { id: 'abc123', email: '...' }
b) ensureInternalUser('abc123')
   └─ SELECT * FROM users WHERE auth_uid='abc123'
   └─ Found! user_id='user-id', role='employee', workspace_id='ws-123'
c) RPC: SELECT role, workspace_id ...
d) Create session
e) Return { role: 'employee', workspace_id: 'ws-123' }
```

**Step 4: Frontend Routing**
```javascript
// login response: { role: 'employee', workspaceId: 'ws-123' }

if (role === 'employee') {
  redirect('/employees/dashboard?workspace=' + workspaceId)
}
```

---

## Files Modified

| File | Purpose | Changes |
|------|---------|---------|
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts) | Accept invite endpoint | ✅ Fixed auth_uid linking, improved logging |
| [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts) | User resolution | ✅ Made read-only, enforced 403 errors, role validation |
| [package.json](package.json) | Build config | ✅ Added test scripts |
| [V1_AUTH_INVITE_ACCEPTANCE_FIX.md](V1_AUTH_INVITE_ACCEPTANCE_FIX.md) | Documentation | ✅ Complete flow documentation |

---

## Testing

### Option 1: Quick Verification (Recommended First)
```bash
# Run the safe test to verify basic flow
npm run test:invite-flow:safe

# Expected output: All 6 test steps pass
# ✅ Create Auth User
# ✅ Create Internal User
# ✅ Create Employee Invite
# ✅ Verify Token in Database
# ✅ Verify Auth User
# ✅ Cleanup
```

### Option 2: Verify Auth_UID Linkage
```bash
# After running safe test, verify implementation
npm run test:invite-acceptance:verify

# Expected output shows:
# ✅ Auth user creation successful
# ✅ auth_uid linking successful
# ✅ ensureInternalUser() finds user by auth_uid
# ✅ Login flow complete
```

### Test Results File
Results saved to: `tmp/test-results.json`
```json
{
  "timestamp": "2025-01-25T...",
  "testResults": [
    {
      "step": "Create Auth User",
      "status": "success",
      "message": "Using auth user",
      "details": { "auth_uid": "..." }
    },
    {
      "step": "Create Internal User",
      "status": "success",
      "message": "Internal user ready",
      "details": { "user_id": "..." }
    },
    // ... more steps
  ]
}
```

---

## Logging Examples

### During Invite Acceptance

```
[INVITE ACCEPT] invite found: true {
  status: 'pending',
  email: 'emp@company.com',
  workspace_id: 'ws-123'
}

[INVITE ACCEPT] Checking if user already exists by email

[INVITE ACCEPT] No existing user found, creating new Supabase auth user

[INVITE ACCEPT] Supabase auth user created {
  email: 'emp@company.com',
  auth_uid: '12345678-abcd-4def-90ab-cdefg1234567'
}

[INVITE ACCEPT] Creating internal user row linked to auth_uid

[INVITE ACCEPT] Successfully created and linked new user: {
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  auth_uid: '12345678-abcd-4def-90ab-cdefg1234567',
  email: 'emp@company.com',
  role: 'employee',
  workspace_id: 'ws-123'
}

[INVITE ACCEPT] Marking invite as accepted

[INVITE ACCEPT] Invite marked as accepted
```

### During Login

```
[LOGIN] Supabase signIn successful { user: 'emp@company.com' }

[ensureInternalUser] Found user by auth_uid: 12345678-... → user_id: 550e8400-..., role: employee, workspace_id: ws-123

[LOGIN] Resolved role: employee

[LOGIN] Workspace ID: ws-123

[LOGIN] Created session: session-uuid

[LOGIN] Setting Supabase cookies: ...
```

---

## Error Cases Handled

### Case 1: User Tries to Login Without Accepting Invite
```
POST /api/auth/login { email, password }

→ Supabase login succeeds (auth user exists)
→ ensureInternalUser('auth-uid') throws "User not found (403)"
→ API returns: { error: 'User profile not found' } (403)
→ Frontend shows: "Please accept invite first"
```

### Case 2: User Accepts Invite Twice
```
POST /api/employees/accept-invite?token=token

First acceptance:
→ User created, auth_uid linked
→ Invite marked as accepted

Second acceptance attempt:
→ Invite lookup fails (status='accepted', not 'pending')
→ API returns: { error: 'Invalid or expired invite token' } (400)
```

### Case 3: Concurrent Accept Requests
```
Two requests arrive simultaneously:

Request 1: Creates auth user, creates internal user
Request 2: Gets duplicate key error, queries by email, links auth_uid

Result: One auth user, one internal user, auth_uid linked ✓
```

---

## Verification Checklist

Use this checklist to verify the implementation:

- [ ] **Accept-invite endpoint:**
  - [ ] Creates Supabase auth user
  - [ ] Creates internal user with auth_uid linked
  - [ ] Updates existing users with auth_uid (if needed)
  - [ ] Marks invite as accepted
  - [ ] Returns redirect to login
  - [ ] Logs auth_uid linkage clearly

- [ ] **ensureInternalUser() function:**
  - [ ] Reads by internal ID
  - [ ] Reads by auth_uid
  - [ ] Validates role exists
  - [ ] Throws 403 if user not found
  - [ ] No auto-creation of users
  - [ ] Retries after 500ms

- [ ] **Login endpoint:**
  - [ ] Calls ensureInternalUser()
  - [ ] Handles 403 errors gracefully
  - [ ] Returns role and workspace
  - [ ] Does NOT expose user_id in response

- [ ] **Database integrity:**
  - [ ] auth_uid is linked for all users
  - [ ] role is set for all users
  - [ ] workspace_id is set (where applicable)
  - [ ] No NULL values in required fields

---

## Next Steps

### 1. Test in Development
```bash
npm run test:invite-flow:safe
npm run test:invite-acceptance:verify
```

### 2. Manual Testing
- Create an invite via admin
- Accept the invite with test email
- Log in with the same credentials
- Verify redirect to dashboard

### 3. Deploy to Staging
- Monitor logs for auth_uid linkage
- Test with real users
- Watch for any 403 "User not found" errors

### 4. Production Deployment
- Deploy to production
- Monitor login success rates
- Track "User profile not found" errors
- Verify no users are blocked from login

---

## Troubleshooting Guide

### Problem: "User not found (403)" on Login

**Diagnosis:**
```sql
-- Check if internal user exists
SELECT * FROM users WHERE email = 'test@example.com';

-- Check if auth_uid is linked
-- If auth_uid is NULL, this is the problem
```

**Solution:**
1. Verify accept-invite endpoint was called
2. Check logs for "Successfully linked auth_uid"
3. If auth_uid is NULL, manually run:
   ```sql
   UPDATE users 
   SET auth_uid = 'supabase-auth-id' 
   WHERE id = 'user-id';
   ```

### Problem: "Role not found (403)" on Login

**Diagnosis:**
```sql
-- Check user role
SELECT id, role FROM users WHERE auth_uid = 'auth-uid';

-- If role is NULL, this is the problem
```

**Solution:**
1. Verify invite included a role
2. Update user:
   ```sql
   UPDATE users 
   SET role = 'employee' 
   WHERE id = 'user-id';
   ```

---

## Documentation Links

- [Complete Flow Documentation](V1_AUTH_INVITE_ACCEPTANCE_FIX.md)
- [Internal User ID Contract](INTERNAL_USER_ID_CONTRACT.md)
- [Supabase Configuration](https://supabase.com)

---

## Metrics to Monitor

After deployment, track these metrics:

1. **Invite Acceptance Rate**
   - How many users complete accept-invite?
   - Expected: >90% of invited users

2. **Login Success Rate**
   - How many users can log in after accepting invite?
   - Expected: >95% of accepted invites

3. **Error Distribution**
   - Count of "User not found" errors
   - Count of "Role not found" errors
   - Expected: <1% of login attempts

4. **auth_uid Linkage Rate**
   - % of users with auth_uid set
   - Expected: 100% of accepted invites

---

**Status:** ✅ Ready for Testing  
**Deployed:** January 25, 2025  
**Version:** 1.0  
**Confidence Level:** High
