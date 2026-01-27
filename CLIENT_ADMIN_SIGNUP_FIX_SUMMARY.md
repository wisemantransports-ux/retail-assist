# Client Admin Signup Flow Fix - Complete Summary

## Problem Statement
Client admins could sign up successfully, but were immediately redirected to `/unauthorized` because:
1. Workspace was provisioned (workspace_members table was populated)
2. BUT `/api/auth/me` endpoint didn't look up workspace_id from workspace_members for client_admin role
3. Without workspace_id, middleware rejected access to `/dashboard`

## Solution Implemented

### 1. Fixed `/api/auth/me` Endpoint
**File:** `app/api/auth/me/route.ts`

**Change:** Updated client_admin role resolution to fetch workspace_id from workspace_members table

**Before:**
```typescript
if (clientAdminCheck) {
  role = 'admin';  // Treat client_admin as admin role
  workspaceIdFromRpc = null;  // Will be created during onboarding
}
```

**After:**
```typescript
if (clientAdminCheck) {
  role = 'admin';  // Treat client_admin as admin role
  
  // Try to find workspace_id from workspace_members
  const { data: membershipCheck } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (membershipCheck) {
    workspaceIdFromRpc = membershipCheck.workspace_id;
    console.log('[Auth Me] Resolved workspace for client_admin:', workspaceIdFromRpc);
  }
}
```

**Impact:**
- `/api/auth/me` now returns `{ role: 'admin', workspaceId: '<workspace-id>' }` for client_admin
- Middleware can now properly authorize access to `/dashboard/[workspaceId]`
- Client can redirect user to correct dashboard after login

### 2. Enhanced Workspace Provisioning Logging
**File:** `app/lib/supabase/ensureWorkspaceForUser.ts`

**Changes:**
- Added detailed logging for workspace_members insertion
- Added detailed logging for admin_access insertion  
- Logs now show:
  - When entries are inserted
  - When entries already exist (duplicates)
  - Success confirmation

**Key Log Messages:**
```
[ensureWorkspaceForUser] Inserting workspace_members: user_id=<id> workspace_id=<id>
[ensureWorkspaceForUser] ✓ workspace_members entry created/confirmed
[ensureWorkspaceForUser] ✓ admin_access entry created/confirmed
[ensureWorkspaceForUser] ✓ Workspace provisioning complete for workspace_id: <id>
```

## Complete Client Admin Signup Flow

### Step 1: User Submits Signup Form
- POST to `/api/auth/signup` with email, password, business_name, phone
- Request handler validates inputs and creates auth user

### Step 2: Auth User Created
- Supabase auth user created with email/password
- Service role client used to bypass RLS

### Step 3: Internal User Record Created
- RPC `rpc_create_user_profile` called to create `users` table entry
- Sets `users.role = 'client_admin'` for non-super-admin signups
- Entry includes business_name, plan_type, etc.

### Step 4: Workspace Provisioning (ensureWorkspaceForUser)
- ✓ Checks if user already has workspace membership
- ✓ Creates default workspace named "My Workspace" (or reuses if duplicate)
- ✓ Inserts into `workspace_members(user_id, workspace_id, role='admin')`
- ✓ Inserts into `admin_access(user_id, workspace_id, role='admin')`
- ✓ Returns workspaceId to signup handler

### Step 5: Session Created
- Session cookie created with internal user ID
- Session stored in database
- Cookie returned in signup response

### Step 6: Client-side After Signup
- Client receives workspaceId from signup response
- Client redirects to `/api/auth/login` to establish Supabase session
- OR client stores workspaceId in localStorage for next step

### Step 7: User Visits Dashboard
- Browser has session cookie from signup/login
- Client calls `useAuth()` hook
- Hook calls `/api/auth/me` to get current auth state

### Step 8: /api/auth/me Processing
- ✓ Verifies Supabase auth session exists
- ✓ Looks up user in `users` table
- ✓ Detects `users.role = 'client_admin'`
- ✓ **NEW:** Queries `workspace_members` to find workspace_id
- ✓ Returns: `{ role: 'admin', workspaceId: '<workspace-id>' }`

### Step 9: Middleware Authorization
- Browser requests `/dashboard/[workspaceId]`
- Middleware calls `/api/auth/me`
- Receives `{ role: 'admin', workspaceId: '<workspace-id>' }`
- **Validates:** role='admin' MUST have workspace_id ✓
- **Validates:** user is in workspace_members for that workspace ✓
- **Result:** Request allowed, page rendered

### Step 10: Dashboard Loads
- Client admin sees their workspace dashboard
- Can create agents, configure automation, etc.
- session_id cookie maintains authentication

## Database Tables Involved

### auth.users (Supabase Auth)
- auth_uid: User's authentication ID
- email, password_hash: Auth credentials
- Managed by Supabase

### public.users
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  auth_uid UUID REFERENCES auth.users(id),
  role TEXT, -- 'super_admin' only for super admins
  email TEXT,
  business_name TEXT,
  phone TEXT,
  plan_type TEXT,
  ...
)
```

### public.workspaces
```sql
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES public.users(id),
  name TEXT UNIQUE, -- "My Workspace"
  description TEXT,
  created_at TIMESTAMP
)
```

### public.workspace_members
```sql
CREATE TABLE public.workspace_members (
  workspace_id UUID REFERENCES public.workspaces(id),
  user_id UUID REFERENCES public.users(id),
  role TEXT, -- 'admin', 'member', 'staff'
  PRIMARY KEY (workspace_id, user_id),
  UNIQUE(workspace_id, user_id)
)
```

### public.admin_access
```sql
CREATE TABLE public.admin_access (
  user_id UUID REFERENCES public.users(id),
  workspace_id UUID REFERENCES public.workspaces(id),
  role TEXT, -- 'admin'
  PRIMARY KEY (user_id, workspace_id),
  UNIQUE(user_id, workspace_id)
)
```

## RLS Policy Requirements

For the flow to work, RLS policies must allow:

1. **workspace_members SELECT** via join to workspace ownership:
   ```sql
   -- Authenticated users can read workspace_members for their workspaces
   ```

2. **workspace_members INSERT** via service role:
   - Service role BYPASSES RLS (no policy needed)
   - Called only by backend signup endpoint

3. **admin_access SELECT** via workspace_members join:
   - User must be in workspace_members to access admin_access

## Testing Checklist

- [ ] Signup endpoint receives client_admin credentials
- [ ] Internal user created with role='client_admin'
- [ ] Workspace created with unique name
- [ ] workspace_members row inserted (user_id, workspace_id)
- [ ] admin_access row inserted (user_id, workspace_id)
- [ ] Signup response includes workspaceId
- [ ] Session created and cookie set
- [ ] Client redirects to login/dashboard
- [ ] useAuth hook calls /api/auth/me
- [ ] /api/auth/me returns role='admin' and workspaceId
- [ ] Middleware authorizes /dashboard/[workspaceId]
- [ ] Dashboard loads without /unauthorized redirect

## Error Cases Handled

1. **Duplicate Workspace Name**
   - Existing workspace fetched and reused
   - User linked to existing workspace
   - No error returned

2. **User Already a Workspace Member**
   - workspace_members INSERT with ignoreDuplicates=true
   - Silently skipped, no error
   - User already has access

3. **User Already an Admin**
   - admin_access INSERT with ignoreDuplicates=true
   - Silently skipped, no error
   - User already has admin role

4. **Missing workspace_members Entry**
   - /api/auth/me now checks workspace_members
   - Returns workspaceId if entry exists
   - Otherwise sets workspaceId=null (onboarding needed)

## Files Modified

1. `app/api/auth/me/route.ts`
   - Enhanced client_admin workspace resolution
   - Queries workspace_members for workspace_id

2. `app/lib/supabase/ensureWorkspaceForUser.ts`
   - Added detailed logging for debugging
   - Improved error messages
   - Already handles idempotent operations

## Backward Compatibility

✓ All changes are backward compatible
✓ No database schema changes required
✓ Existing client admins with workspaces unaffected
✓ RLS policies unchanged
✓ Middleware behavior unchanged
✓ No breaking API changes

## Next Steps (Not Required)

1. Optional: Add migration SQL if workspace_members doesn't exist
   - But table already exists in migration 002_complete_schema.sql

2. Optional: Cache workspace_id in users table
   - Would reduce queries but requires schema change
   - Current approach is cleaner

3. Optional: Add workspace_id to auth.users custom claims
   - Would provide auth-level workspace association
   - Current endpoint-level resolution is sufficient

## References

- Signup Handler: `app/api/auth/signup/route.ts`
- Auth ME Endpoint: `app/api/auth/me/route.ts`
- Workspace Provisioning: `app/lib/supabase/ensureWorkspaceForUser.ts`
- Middleware: `middleware.ts` (unchanged)
- RLS Policies: `supabase/migrations/038_comprehensive_signup_invite_flow_migration.sql`
