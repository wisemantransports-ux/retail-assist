# V1 Auth - Mock Mode Fix for Invite Acceptance

## Issue Found

When invitation is accepted and user tries to login in **MOCK MODE**:

```
✅ Invite accepted: User created in real Supabase
❌ Login fails: "User not found (403)"

Reason: User was created in real Supabase, but ensureInternalUser() 
looks in mock database (tmp/dev-seed/database.json) in mock mode.
```

## Root Cause

The accept-invite endpoint uses real Supabase, but login in mock mode tries to find the user in the local mock database file, which doesn't have the newly created user.

## Solution

Added **mock database sync** to accept-invite endpoint:

After successfully accepting an invite, if the system is in mock mode:
1. Read `tmp/dev-seed/database.json`
2. Add the newly created user to the mock database
3. Write back to file
4. User can now be found during login

## Changes

**File:** [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts)

**New Step 5:** Sync to Mock Database
```typescript
if (process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true' || process.env.MOCK_MODE === 'true') {
  // Read mock database
  // Add user to mock database
  // Write back to file
  // Log success
}
```

This ensures that when `ensureInternalUser()` runs in mock mode during login, it finds the user in the mock database.

## How It Works Now

```
1. Employee accepts invite
   → Create Supabase auth user (real DB)
   → Create internal user (real DB)
   → Link auth_uid (real DB)
   → Sync to mock DB ← NEW
   → Return login redirect

2. Employee logs in
   → ensureInternalUser(auth_uid)
   → Check mock database
   → Found! ✅
   → Role resolved
   → Login succeeds
```

## Testing

After this fix, the login flow should work in mock mode:

1. Accept invite with valid token
2. Redirect to `/auth/login?invite=accepted`
3. Log in with email and password
4. Should succeed and redirect to dashboard

Expected logs:
```
[INVITE ACCEPT] Mock mode detected, syncing user to mock database
[INVITE ACCEPT] User synced to mock database: { user_id: '...', auth_uid: '...' }
[LOGIN] Found user by auth_uid (in mock database)
[LOGIN] Resolved role: employee
[LOGIN] Created session
```

## Status

✅ Fix implemented
✅ Ready for testing

Next: Run the application and test the invite→login flow again.
