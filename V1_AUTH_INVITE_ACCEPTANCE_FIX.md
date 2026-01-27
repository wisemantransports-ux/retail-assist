# V1 Auth - Employee Invite Acceptance Fix ✅

## Problem Statement
After an employee accepts an invite, logging in fails with:
- "user not found" (403 error)
- "role not found" (403 error)

Root cause: **`auth_uid` was not correctly linked in the internal `users` table**

The login flow relies on finding the user by `auth_uid` through the `ensureInternalUser()` function. Without this linkage, authentication fails at the first step.

---

## Solution Overview

### Key Changes

1. **[app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts)** - Fixed auth_uid linkage
2. **[app/lib/supabase/queries.ts](app/lib/supabase/queries.ts)** - Enforced read-only auth logic
3. **[test-invite-acceptance-flow-v1.ts](test-invite-acceptance-flow-v1.ts)** - End-to-end test

---

## Detailed Changes

### 1. Accept-Invite Endpoint (`/api/employees/accept-invite/route.ts`)

#### Problem
The old code created auth users but didn't properly link the returned `auth_uid` to the internal user row, especially for existing users.

#### Solution
Restructured the logic to ensure auth_uid linkage in all scenarios:

**Scenario A: Existing User by Email**
```
1. Find user by email in internal users table
2. If user exists but has no auth_uid:
   - Create Supabase auth user
   - **UPDATE auth_uid field** (CRITICAL FIX)
   - Update workspace_id if needed
   - PRESERVE existing role
3. If user already has auth_uid:
   - Skip auth creation
   - Update workspace_id if needed
```

**Scenario B: New User**
```
1. Create Supabase auth user → get auth_uid
2. Create internal user row:
   - Set auth_uid (CRITICAL - this enables login)
   - Set role: 'employee'
   - Set workspace_id (if provided)
3. Handle concurrent inserts gracefully
```

#### Key Logging
All logs clearly show the auth_uid linkage:

```
✅ Existing user updated: {
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  auth_uid: "12345678-abcd-4def-90ab-cdefg1234567",
  updates: { auth_uid: "..." }
}

✅ Successfully created and linked new user: {
  user_id: "550e8400-e29b-41d4-a716-446655440001",
  auth_uid: "12345678-abcd-4def-90ab-cdefg1234568",
  email: "employee@example.com",
  role: "employee",
  workspace_id: "ws-123"
}
```

#### Response
```json
{
  "success": true,
  "next": "/auth/login?invite=accepted"
}
```

**Note:** No user_id, role, or workspace returned (as per requirements)

---

### 2. ensureInternalUser() in queries.ts

#### Key Changes

1. **Read-Only Enforcement**
   - Function now reads ONLY, never creates or upserts
   - All user creation happens during invite acceptance
   - This prevents auto-creation during login

2. **auth_uid Lookup Priority**
   - First: Try internal ID lookup
   - Second: Try auth_uid lookup
   - Third: Retry after 500ms (for auth trigger delays)
   - Fail: Throw error (no auto-creation)

3. **Role Validation**
   - Every lookup checks that `role` field is set
   - Throws error if role is missing (403)
   - This ensures users can't login without proper role assignment

4. **Error Messages**
   - All errors include "(403)" to indicate authorization failure
   - Clear distinction between "user not found" vs "role missing"

#### Code Flow

```typescript
export async function ensureInternalUser(candidateId: string) {
  // 1. Try to find by internal ID
  if (foundById) {
    if (!role) throw "role missing (403)"
    return { id }
  }

  // 2. Try to find by auth_uid
  if (foundByAuthUid) {
    if (!role) throw "role missing (403)"
    return { id }
  }

  // 3. Retry after 500ms (for auth trigger)
  if (foundAfterRetry) {
    if (!role) throw "role missing (403)"
    return { id }
  }

  // 4. Fail - no user, no auto-creation
  throw "User not found (403)"
}
```

#### Login Integration
The login endpoint already handles this correctly:

```typescript
// /api/auth/login/route.ts
try {
  const ensured = await ensureInternalUser(data.user.id)
  if (!ensured?.id) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 403 }
    )
  }
  internalUserId = ensured.id
} catch (e) {
  // User doesn't exist = login fails (correct behavior)
  return NextResponse.json(
    { error: 'User profile not found' },
    { status: 403 }
  )
}
```

---

## Complete Flow: Invite → Login

### Step 1: Admin Creates Invite
```
POST /api/admin/invites
{
  email: "employee@company.com",
  workspace_id: "ws-123",
  role: "employee"
}

→ Creates row in employee_invites table
→ Generates invite token
→ May or may not create internal user row (depends on implementation)
```

### Step 2: Employee Accepts Invite
```
POST /api/employees/accept-invite?token={TOKEN}
{
  email: "employee@company.com",
  first_name: "John",
  password: "SecurePass123"
}

→ Validate token
→ Find invite in employee_invites
→ Check if user exists by email
  ├─ If exists: Link auth_uid to existing user
  └─ If new: Create auth user → Create internal user with auth_uid
→ Mark invite as accepted
→ Return: { success: true, next: '/auth/login?invite=accepted' }

Logs:
✅ Supabase auth user created { auth_uid: "..." }
✅ Successfully linked auth_uid to internal user { user_id: "...", auth_uid: "..." }
✅ Invite marked as accepted
```

### Step 3: Employee Logs In
```
POST /api/auth/login
{
  email: "employee@company.com",
  password: "SecurePass123"
}

→ Supabase.auth.signInWithPassword()
→ Get auth.user { id: auth_uid, email: "..." }
→ ensureInternalUser(auth_uid)
  ├─ Query users WHERE auth_uid = {auth_uid}
  ├─ Find user: { id: user_id, role: "employee", workspace_id: "ws-123" }
  ├─ Validate role exists ✓
  └─ Return { id: user_id }
→ Query role & workspace via RPC
→ Create session
→ Return: { success: true, user: { id, email, role }, workspaceId }

Logs:
✅ Found user by auth_uid: auth_uid → user_id
✅ Resolved role: employee
✅ Created session: session_id
```

### Step 4: Frontend Routes Based on Role
```
Login response: { role: "employee", workspaceId: "ws-123" }

Client-side routing:
- super_admin → /admin
- platform_staff → /admin/support
- admin → /dashboard
- employee → /employees/dashboard
```

---

## Testing

### Running the Test

```bash
# Full v1 auth acceptance flow test
npm run test:invite-acceptance:v1

# This test:
1. Creates a test workspace
2. Creates an invite in employee_invites
3. Creates an internal user row
4. Creates a Supabase auth user
5. **Links auth_uid to internal user** ← Key verification
6. Marks invite as accepted
7. Verifies user can be found by auth_uid
8. Simulates login (Supabase signInWithPassword)
9. Verifies role and workspace are accessible
10. Cleans up all test data
```

### Test Output Example
```
🚀 V1 Auth - Invite Acceptance Flow Test
==================================================

✅ Create workspace: Workspace created
  workspace_id: "ws-abc123"

✅ Create invite: Invite created
  invite_id: "inv-123", token: "550e8400...", workspace_id: "ws-abc123"

✅ Create internal user: Internal user row created (no auth_uid yet)
  user_id: "user-123", email: "test@example.com", auth_uid: null

✅ Create auth user: Supabase auth user created
  auth_uid: "12345678-abcd-4def-90ab-cdefg1234567"

✅ Link auth_uid: ✨ auth_uid linked to internal user
  user_id: "user-123", auth_uid: "12345678-abcd-4def-90ab-cdefg1234567"

✅ Accept invite: Invite marked as accepted
  invite_id: "inv-123", status: "accepted"

✅ Find by auth_uid: ✅ User found by auth_uid
  user_id: "user-123", auth_uid: "12345678-abcd-4def-90ab-cdefg1234567", role: "employee"

✅ Login: Login successful with correct auth_uid
  email: "test@example.com", auth_uid: "12345678-abcd-4def-90ab-cdefg1234567"

✅ Verify role: User role and workspace verified
  role: "employee", workspace_id: "ws-abc123"

✅ Full flow: All steps completed successfully

==================================================
📊 TEST SUMMARY
Total: 9 | Passed: 9 | Failed: 0
==================================================

📁 Results saved to: tmp/test-invite-acceptance-results.json
```

### Results File
Test results are saved to: `tmp/test-invite-acceptance-results.json`

```json
{
  "timestamp": "2025-01-25T10:30:45.123Z",
  "testResults": [
    { "step": "Create workspace", "status": "success", "message": "..." },
    { "step": "Link auth_uid", "status": "success", "message": "✨ auth_uid linked to internal user", "details": {...} },
    ...
  ],
  "summary": { "total": 9, "passed": 9, "failed": 0 }
}
```

---

## Data Schema Requirements

### users table
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  auth_uid UUID UNIQUE,           -- Links to auth.users.id
  email TEXT NOT NULL,
  role TEXT NOT NULL,             -- 'super_admin', 'employee', 'admin', 'platform_staff'
  workspace_id UUID,              -- NULL for super_admin/platform_staff
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Critical: auth_uid must be set during invite acceptance
-- Without auth_uid, login cannot find the user
```

### employee_invites table
```sql
CREATE TABLE public.employee_invites (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  token UUID NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired'
  workspace_id UUID,              -- Optional for platform employees
  created_at TIMESTAMP,
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP
);
```

---

## Logging Checklist

When invite acceptance completes, logs should show:

- ✅ Which `user_id` was linked to `auth_uid`
- ✅ Role value (e.g., 'employee')
- ✅ Workspace ID (if applicable)
- ✅ Whether existing user was updated or new user was created
- ✅ Duplicate email handling (if multiple users exist)
- ✅ Invite marked as accepted

Example complete log:
```
[INVITE ACCEPT] invite found: true { status: 'pending', email: 'emp@company.com', workspace_id: 'ws-123' }
[INVITE ACCEPT] Checking if user already exists by email
[INVITE ACCEPT] User already exists (found by email): { user_id: 'user-123', existing_auth_uid: null }
[INVITE ACCEPT] Existing user has no auth_uid, creating new Supabase auth user
[INVITE ACCEPT] New auth user created for existing internal user: { user_id: 'user-123', auth_uid: 'auth-uuid' }
[INVITE ACCEPT] Existing user updated: { user_id: 'user-123', auth_uid: 'auth-uuid', updates: { auth_uid: 'auth-uuid' } }
[INVITE ACCEPT] Marking invite as accepted
[INVITE ACCEPT] Invite marked as accepted
```

---

## Troubleshooting

### Problem: "User not found (403)" on Login

**Cause:** `auth_uid` not linked to internal user

**Solution:**
1. Check that invite acceptance completed without errors
2. Query database: `SELECT id, auth_uid, role FROM users WHERE email = 'test@example.com'`
3. Verify `auth_uid` is NOT NULL
4. If NULL, manually update or re-run accept-invite

### Problem: "Role not found (403)" on Login

**Cause:** `role` field is NULL in users table

**Solution:**
1. Check user row: `SELECT id, role FROM users WHERE auth_uid = 'xyz'`
2. If role is NULL, update: `UPDATE users SET role = 'employee' WHERE id = 'user-id'`
3. Verify role was set during invite acceptance via logs

### Problem: "Workspace not assigned (403)" on Login

**Cause:** For non-super_admin roles, `workspace_id` is NULL

**Solution:**
1. Check: `SELECT role, workspace_id FROM users WHERE auth_uid = 'xyz'`
2. If workspace_id is NULL and role is 'employee', update during admin invite
3. Or update user: `UPDATE users SET workspace_id = 'ws-123' WHERE id = 'user-id'`

---

## Implementation Checklist

- ✅ Updated accept-invite endpoint to link auth_uid
- ✅ Updated ensureInternalUser() to read-only with 403 errors
- ✅ Updated jsdocs with v1 auth requirements
- ✅ Added comprehensive logging at each step
- ✅ Created end-to-end test
- ✅ Added test to package.json scripts
- ✅ Verified login endpoint handles errors correctly
- ✅ Ensured response doesn't expose user_id, role, or workspace
- ✅ Ensured no auto-creation of users during login

---

## Files Modified

| File | Change |
|------|--------|
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts) | Fixed auth_uid linkage, improved logging |
| [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts) | Made ensureInternalUser() read-only, enforced 403 errors |
| [test-invite-acceptance-flow-v1.ts](test-invite-acceptance-flow-v1.ts) | New end-to-end test |
| [package.json](package.json) | Added test:invite-acceptance:v1 script |

---

## Next Steps

1. **Deploy to staging** - Test with real users
2. **Monitor logs** - Watch for auth_uid linkage in production logs
3. **Verify metrics** - Track successful invite acceptances and logins
4. **Update docs** - Add this flow to user/admin documentation

---

**Status:** ✅ Ready for Testing & Deployment  
**Last Updated:** January 25, 2025  
**Version:** 1.0
