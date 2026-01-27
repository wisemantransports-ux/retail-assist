# Client Admin Signup Testing Guide

## Quick Test Flow

### 1. Sign Up as New Client Admin
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123456",
    "business_name": "Test Business",
    "phone": "555-1234",
    "plan_type": "starter"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "<internal_user_id>",
    "email": "admin@test.com",
    "role": "client_admin"
  },
  "internalUserId": "<internal_user_id>",
  "workspaceId": "<workspace_id>",
  "message": "Account created successfully."
}
```

**Server Logs Should Show:**
```
[SIGNUP] Client admin signup detected - provisioning workspace
[ensureWorkspaceForUser] Inserting workspace_members: user_id=<id> workspace_id=<id>
[ensureWorkspaceForUser] ✓ workspace_members entry created/confirmed
[ensureWorkspaceForUser] ✓ admin_access entry created/confirmed
[ensureWorkspaceForUser] ✓ Workspace provisioning complete for workspace_id: <id>
[SIGNUP] ✓ Workspace provisioned for client_admin: <workspace_id> created: true
[SIGNUP] Session cookie set: <session_id>
```

### 2. Check Auth State
```bash
# First establish session by visiting login/signup page
curl -X GET http://localhost:3000/api/auth/me \
  -H "Cookie: session_id=<session_id_from_signup>"
```

**Expected Response:**
```json
{
  "session": { "user": { "id": "<auth_uid>" } },
  "role": "admin",
  "workspaceId": "<workspace_id>",
  "user": {
    "id": "<internal_user_id>",
    "email": "admin@test.com",
    "role": "admin",
    "workspace_id": "<workspace_id>"
  }
}
```

**Server Logs Should Show:**
```
[Auth Me] Resolved role: admin (from users table as client_admin) with workspace: <workspace_id>
```

### 3. Verify Database State
```sql
-- Check users table
SELECT id, auth_uid, role FROM public.users WHERE email = 'admin@test.com';
-- Should show: role = 'client_admin'

-- Check workspaces table
SELECT id, name, owner_id FROM public.workspaces WHERE name = 'My Workspace';
-- Should show: workspace exists

-- Check workspace_members
SELECT * FROM public.workspace_members 
WHERE user_id = '<internal_user_id>';
-- Should show: user is member with role='admin'

-- Check admin_access
SELECT * FROM public.admin_access 
WHERE user_id = '<internal_user_id>';
-- Should show: user has admin access for workspace
```

### 4. Test Dashboard Access
1. Go to browser: `http://localhost:3000/auth/signup`
2. Fill form with test credentials
3. Submit form
4. Should redirect to `/dashboard/[workspaceId]`
5. Dashboard should load without `/unauthorized` redirect

## Duplicate Signup Test

### Sign Up Same User Twice
```bash
# First signup (from above)
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123456",
    "business_name": "Test Business",
    "phone": "555-1234"
  }'

# Second signup (will fail at auth level - user already exists)
# This tests idempotency at the workspace level
```

**Expected:**
- Auth will reject duplicate email
- Workspace provisioning would be idempotent if signup succeeded

### Test Workspace Reuse
```bash
# Sign up different email for same workspace
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin2@test.com",
    "password": "Test123456",
    "business_name": "Test Business",
    "phone": "555-5678"
  }'
```

**Server Logs Should Show:**
```
[ensureWorkspaceForUser] Duplicate workspace name detected, fetching existing...
[ensureWorkspaceForUser] Reusing existing workspace: <workspace_id>
[ensureWorkspaceForUser] ✓ workspace_members entry created/confirmed
```

## Troubleshooting

### Issue: /unauthorized redirect after signup
**Check:**
1. `workspace_members` table has entry for user_id + workspace_id
2. `/api/auth/me` returns workspaceId
3. Middleware allows `/dashboard/[workspaceId]`

**Logs to check:**
```
[ensureWorkspaceForUser] Inserting workspace_members
[Auth Me] Resolved workspace for client_admin
[Middleware] ✓ Client admin authorized
```

### Issue: "workspace_members" not found error
**Check:**
1. Database has workspace_members table
2. Run migration: `002_complete_schema.sql`
3. Check service role key is valid

**Fix:**
```sql
-- Verify table exists
\dt public.workspace_members
-- Should show table definition

-- Check RLS is enabled
SELECT * FROM pg_policies WHERE tablename = 'workspace_members';
```

### Issue: User created but no workspace
**Check:**
1. `ensureWorkspaceForUser` was called
2. Service role credentials in `.env`
3. Server logs show provisioning attempts

**Server Logs:**
```
[SIGNUP] Client admin signup detected - provisioning workspace
[ensureWorkspaceForUser] Starting provisioning...
```

### Issue: workspace_members created but admin_access missing
**Check:**
1. admin_access table exists
2. User had workspace_id at admin_access insertion time
3. No unique constraint violation

**Fix:**
```sql
-- Manually add admin_access
INSERT INTO public.admin_access (user_id, workspace_id, role)
SELECT <user_id>, <workspace_id>, 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_access 
  WHERE user_id = <user_id> AND workspace_id = <workspace_id>
);
```

## Expected File Modifications

✓ `app/api/auth/me/route.ts` - workspace resolution for client_admin
✓ `app/lib/supabase/ensureWorkspaceForUser.ts` - enhanced logging
✓ No database schema changes required
✓ No middleware changes
✓ No RLS policy changes

## Rollback (if needed)

All changes are non-breaking. To revert:
1. Revert `app/api/auth/me/route.ts` to check only admin_access for workspace_id
2. Revert `app/lib/supabase/ensureWorkspaceForUser.ts` logging (optional)
3. Existing client admins with admin_access will still work
4. New signups will need admin_access entry instead of workspace_members lookup
