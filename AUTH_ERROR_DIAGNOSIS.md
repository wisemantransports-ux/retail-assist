# Auth Error Diagnosis: `[useAuth] /api/auth/me error: {}`

## Issue Summary
The browser console shows an empty error object `{}` when `/api/auth/me` fails, making it difficult to diagnose the actual problem.

## Root Causes
The empty error object typically indicates one of:

1. **No Role Resolved** (Most Common)
   - User exists and is authenticated
   - But has no entry in: `admin_access`, `users.role='client_admin'`, or `employees`
   - Endpoint returns: `{ status: 403, error: "User role not found" }`
   - Fix: Ensure user has a role assignment after signup/login

2. **User Creation Failed**
   - `ensureInternalUser()` couldn't create the user
   - Endpoint returns: `{ status: 500, error: "User creation failed" }`
   - Fix: Check database permissions and auth_uid validity

3. **Database Query Error**
   - User lookup or role resolution query failed
   - Endpoint returns: `{ status: 500, error: "Database error" }`
   - Fix: Check Supabase RLS policies and database state

4. **JSON Parse Error** (After fix)
   - Response isn't valid JSON
   - New error message shows actual HTTP status and text

## Recent Changes (v2)
Enhanced error handling in both endpoints:

### `/api/auth/me/route.ts`
- Added error stack traces to console logging
- Includes `error.message` details in response

### `app/hooks/useAuth.ts`
- Fallback JSON parsing with text response capture
- Logs HTTP status code in all error cases
- Shows original error in error message

## Diagnosis Steps

### Step 1: Check Browser Console
```
[useAuth] /api/auth/me error: { status: 401, error: '...' }
```
- Status 401: User not authenticated → login again
- Status 403: User role not found → check role tables
- Status 500: Server error → check server logs

### Step 2: Check Server Logs
Look for log patterns:
```
[Auth Me] auth user id: <uuid>
[Auth Me] user lookup (admin): FOUND
[Auth Me] Resolved role: <role>  // or "No role resolved"
[Auth Me] Final role: <role>
[Auth Me] Workspace ID: <workspace-id or null>
```

### Step 3: Verify Database Entries
For a user to work, they need:
- ✓ `auth.users` entry (from Supabase Auth)
- ✓ `users` table entry with `auth_uid`
- ✓ ONE of:
  - `users.role = 'super_admin'` (for super admins)
  - `admin_access` entry (for client admins)
  - `employees` entry (for employees)

### Step 4: Check Role Assignment Flow

**For Super Admin:**
- Set `users.role = 'super_admin'` during account creation
- No workspace required

**For Client Admin:**
- After signup: create `users` entry with role = 'client_admin'
- On first login: `ensureWorkspaceForUser()` creates workspace + admin_access entry
- Check that both entries are created

**For Employee:**
- Must have entry in `employees` table with workspace_id
- Typically invited by admin with workspace assignment

## Testing the Fix

### Test Endpoint Directly
```bash
# Without auth (should return 401)
curl http://localhost:3000/api/auth/me

# With valid session (should return user data + role)
curl -b session_cookie http://localhost:3000/api/auth/me
```

### Test User Creation Flow
1. Signup as new client_admin
2. Check server logs for role resolution messages
3. Check `admin_access` table has entry
4. Login should now work

## Next Steps
1. Check server logs to see which step is failing
2. Verify role assignment in database
3. If 403 "User role not found": manually verify role tables or trigger ensureWorkspaceForUser
4. Report status code and error message for next debugging round
