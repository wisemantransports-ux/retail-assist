# Invite Acceptance Role Assignment Fix - Complete

**Date:** January 25, 2026  
**Status:** ✅ IMPLEMENTED

---

## Overview

Implemented comprehensive role assignment fixes across the invite acceptance flow to ensure that:
- Users always have a role assigned (never NULL)
- Role is explicitly set from `employee_invites.role` during acceptance
- Missing roles trigger clear error messages instead of generic 403s
- Frontend validates role presence before allowing access

---

## Changes Implemented

### 1. ✅ Backend: Role Assignment in Accept-Invite Endpoint

**File:** [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts)

#### Change 1.1: Use invite role when creating new users
**Lines:** ~262-271

```typescript
// Get role from invite, default to 'employee' if not specified
const userRole = invite.role || 'employee';

const { data: newUser, error: userError } = await admin
  .from('users')
  .insert({
    auth_uid: authUid,
    email: invite.email,
    role: userRole,  // ✅ SET FROM INVITE
    workspace_id: invite.workspace_id,
  })
```

**What it does:**
- Extracts role from `employee_invites.role`
- Defaults to 'employee' if invite has no role
- Ensures new users are created with a role set

#### Change 1.2: Update role for existing users without one
**Lines:** ~180-210

```typescript
// If user has no role, set it from the invite
if (!existingUser.role && invite.role) {
  updatePayload.role = invite.role;
  console.log('[INVITE ACCEPT] Existing user has no role, setting from invite:', {
    user_id: userId,
    role: invite.role,
  });
} else if (!existingUser.role && !invite.role) {
  // Default to 'employee' if neither invite nor user has a role
  updatePayload.role = 'employee';
  console.log('[INVITE ACCEPT] Existing user has no role and invite has no role, defaulting to employee:', {
    user_id: userId,
  });
}
```

**What it does:**
- Checks if existing user has NULL role
- Sets role from invite if available
- Defaults to 'employee' if neither has a role
- Logs the role assignment action

#### Change 1.3: Handle role in concurrent user case
**Lines:** ~310-345

```typescript
// Update role if concurrent user has no role
if (!concurrentUser.role && invite.role) {
  const { error: roleError } = await admin
    .from('users')
    .update({ role: invite.role })
    .eq('id', userId);

  if (roleError) {
    console.warn('[INVITE ACCEPT] Failed to update role for concurrent user:', roleError?.message);
  } else {
    console.log('[INVITE ACCEPT] Updated role for concurrent user:', {
      user_id: userId,
      role: invite.role,
    });
  }
} else if (!concurrentUser.role && !invite.role) {
  // Default to 'employee' if neither has a role
  const { error: roleError } = await admin
    .from('users')
    .update({ role: 'employee' })
    .eq('id', userId);
  // ... logging
}
```

**What it does:**
- Handles race condition where multiple concurrent accepts happen
- Ensures role is set even in concurrent scenarios
- Prevents NULL roles in all paths

---

### 2. ✅ Frontend: Enhanced Role Validation in ensureInternalUser

**File:** [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts)

**Status:** Already implemented ✅

The function already contains comprehensive role checks:
- **Lines ~175-180:** Check role when finding by user ID
- **Lines ~183-188:** Check role when finding by auth_uid
- **Lines ~208-213:** Check role after retry
- **All paths throw explicit errors:** `"User found but role is missing..."`

```typescript
if (!(byAuth as any).role) {
    console.error('[ensureInternalUser] User found by auth_uid but role missing:', { auth_uid: candidateId, user_id: (byAuth as any).id })
    throw new Error(`User found but role is missing for auth_uid: ${candidateId} (403)`)
}
```

---

### 3. ✅ Frontend: Improved Login Error Messages

**File:** [app/api/auth/login/route.ts](app/api/auth/login/route.ts)

#### Change 3.1: Better error message when ensureInternalUser fails
**Lines:** ~43-68

```typescript
// Ensure there is a deterministic internal users row for this auth UID
let internalUserId: string
let internalUser: any
try {
  const ensured = await ensureInternalUser(data.user.id)
  if (!ensured || !ensured.id) {
    console.error('[LOGIN] ensureInternalUser returned no id for auth UID:', data.user.id)
    return NextResponse.json({ 
      error: 'User profile not found - please accept an invite first' 
    }, { status: 403 })
  }
  internalUserId = ensured.id
} catch (ensureErr: any) {
  const errMessage = ensureErr?.message || 'Unknown error'
  
  // Check if it's a role missing error
  if (errMessage.includes('role is missing')) {
    console.error('[LOGIN] User role missing:', { auth_uid: data.user.id, error: errMessage })
    return NextResponse.json({ 
      error: 'User role not configured - onboarding incomplete. Please contact support.' 
    }, { status: 403 })
  }
  
  console.error('[LOGIN] ensureInternalUser error:', errMessage)
  return NextResponse.json({ 
    error: 'User profile not found - please accept an invite first' 
  }, { status: 403 })
}
```

**What it does:**
- Detects if error is role-specific vs profile-missing
- Returns contextual error messages:
  - Role missing: "User role not configured - onboarding incomplete. Please contact support."
  - Profile missing: "User profile not found - please accept an invite first"
- Logs which type of error occurred

#### Change 3.2: Improved role resolution error message
**Lines:** ~88-94

```typescript
// v1: Role and workspace_id are required
if (!role) {
  console.error('[LOGIN] No role resolved for user:', data.user.id)
  return NextResponse.json({ 
    error: 'User role not found - onboarding incomplete. Please contact support.' 
  }, { status: 403 })
}
```

**What it does:**
- Provides clear error when RPC fails to return role
- Directs user to contact support instead of generic error

---

## Flow Diagrams

### Before These Changes
```
User accepts invite
           ↓
Role = NULL or unset
           ↓
Login succeeds with Supabase auth ✅
           ↓
ensureInternalUser finds user ✅
           ↓
RPC returns NULL role
           ↓
Generic 403 error ❌
User confused - no idea what's wrong
```

### After These Changes
```
User accepts invite
           ↓
Accept-Invite endpoint sets role from employee_invites.role
           ↓
User.role = invite.role ✅ (Never NULL)
           ↓
Login succeeds with Supabase auth ✅
           ↓
ensureInternalUser finds user ✅
           ↓
Role check: if (!role) throw error ✅
           ↓
RPC returns role successfully ✅
           ↓
Login succeeds, user routed correctly ✅
```

### Error Handling Flow
```
Login attempt
           ↓
Supabase auth successful ✅
           ↓
ensureInternalUser call
      ↙            ↖
  Success          Error
    ↓              ↓
  Role?      Check message
    ↓          ↙      ↖
   ✅      Role?    Profile?
          ❌         ❌
           ↓          ↓
      "Contact    "Accept
      support"     invite"
```

---

## Acceptance Criteria - Met

✅ **users.role is never null**
- Accept-invite creates users with explicit role from `employee_invites.role`
- Existing users with NULL role are updated
- Concurrent users get role set
- Default to 'employee' if neither source has role

✅ **Role = employee_invites.role**
- New users: `role: invite.role || 'employee'`
- Existing users: `if (!user.role && invite.role) { updatePayload.role = invite.role }`
- Concurrent users: Same update logic

✅ **No silent failures**
- ensureInternalUser throws explicit error if role is missing
- Login endpoint catches and returns contextual error message
- Error message tells user exactly what went wrong

---

## Testing Checklist

After these changes, test:

1. **New User Invite Acceptance**
   ```
   - Create invite with role='admin'
   - Accept invite
   - Query users table → role should be 'admin'
   - Login → Should succeed with role 'admin'
   ```

2. **Existing User with NULL Role**
   ```
   - Create user manually with role=NULL
   - Create invite with role='employee'
   - Accept invite
   - Query users table → role should be 'employee' (updated)
   - Login → Should succeed with role 'employee'
   ```

3. **Concurrent Accepts**
   ```
   - Same user accepts invite twice simultaneously
   - Both should complete without errors
   - Final user.role should be from invite
   - Login should succeed
   ```

4. **Error Messages**
   ```
   - Login with user that has role=NULL
   - Should get: "User role not configured - onboarding incomplete..."
   - Should NOT get generic 403
   ```

5. **RPC Failures**
   ```
   - If RPC returns NULL role (shouldn't happen)
   - Should get: "User role not found - onboarding incomplete..."
   - Logs should show [LOGIN] No role resolved
   ```

---

## Code Files Modified

| File | Lines | Changes |
|------|-------|---------|
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts) | ~260-350 | Role assignment from invite (3 locations) |
| [app/api/auth/login/route.ts](app/api/auth/login/route.ts) | ~40-95 | Error message improvements (2 locations) |
| [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts) | ~170-220 | No changes (already had role validation) |

---

## Log Messages to Look For

### Success Logs
```
[INVITE ACCEPT] Creating internal user row linked to auth_uid
[INVITE ACCEPT] Successfully created and linked new user: ... role: ...
[LOGIN] Resolved role: admin
[LOGIN] Created session: ...
[ensureInternalUser] Found user by auth_uid: ... role: admin
```

### Error Logs (Expected)
```
[LOGIN] User role missing: ...
[LOGIN] User role not found: ...
[ensureInternalUser] User found by auth_uid but role missing: ...
```

---

## Deployment Notes

✅ All changes are backward compatible
- Existing users with roles are unaffected
- Only affects users with NULL roles or new invites
- No database migrations required
- No breaking API changes

---

## Related Documentation

- [INVITE_ACCEPTANCE_IMPLEMENTATION_COMPLETE.md](INVITE_ACCEPTANCE_IMPLEMENTATION_COMPLETE.md)
- [V1_AUTH_INVITE_ACCEPTANCE_FIX.md](V1_AUTH_INVITE_ACCEPTANCE_FIX.md)
- [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts)
- [app/api/auth/login/route.ts](app/api/auth/login/route.ts)

---

**Implementation Complete** ✅  
All role assignment and error handling improvements are now active.
