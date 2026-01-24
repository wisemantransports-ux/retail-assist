# Comprehensive Signup & Invite Flow Migration Guide

## Overview

This migration (`038_comprehensive_signup_invite_flow_migration.sql`) fixes all issues preventing the signup and invite flows from working. It ensures:

1. **Correct table schemas** - All required columns exist with proper types
2. **Proper auth_uid linking** - Users are correctly linked to Supabase auth
3. **Working RLS policies** - Permissions are enforced correctly  
4. **RPC functions** - All stored procedures work end-to-end
5. **Multiple account support** - System handles multiple users and workspaces correctly
6. **Data integrity** - Constraints prevent invalid states (e.g., user can't be both admin and employee)

---

## What Was Fixed

### Missing Columns
- `users.role` - Used by `rpc_get_user_access` to identify super_admins
- `users.business_name` - Stored during signup
- `users.phone` - Stored during signup
- `users.plan_type` - Tracks subscription plan
- `employees.full_name` - Employee's full name
- `employees.phone` - Employee's phone number

### Broken RLS Policies
- **employee_invites**: Could not be read by unauthenticated users (needed for invite acceptance)
- **admin_access**: Policies assumed `user_id` column in junction table, but was using subqueries
- **employees**: Policies didn't properly check workspace admin permissions
- **users**: Super admin read policy was missing

### Incorrect RPC Functions
- `rpc_create_user_profile`: Didn't set `users.role` properly for super_admin flag
- `rpc_get_user_access`: Assumed `users.id` directly, but needed to join via `auth.uid()`
- `rpc_accept_employee_invite`: Missing `full_name` and `phone` parameters

### Missing Constraints
- No unique constraint enforcing single workspace per employee
- No check preventing users from being both admin and employee
- Missing auth_uid → users.id links

---

## Step-by-Step Implementation

### 1. Pre-Migration Backup (Recommended)

```bash
# Export current data as backup
pg_dump postgresql://user:password@db.supabase.co:5432/postgres \
  --schema=public \
  --table=users \
  --table=workspaces \
  --table=admin_access \
  --table=employees \
  --table=employee_invites \
  > backup_before_038.sql
```

### 2. Run the Migration

**Option A: Via Supabase Dashboard**
1. Go to **SQL Editor** → **New Query**
2. Copy the full contents of `038_comprehensive_signup_invite_flow_migration.sql`
3. Click **Run**
4. Wait for completion (should be <30 seconds)

**Option B: Via psql CLI**
```bash
psql postgresql://user:password@db.supabase.co:5432/postgres \
  -f supabase/migrations/038_comprehensive_signup_invite_flow_migration.sql
```

**Option C: Via Supabase CLI**
```bash
supabase db push
```

### 3. Verify Migration Success

Run these queries in Supabase SQL Editor:

```sql
-- ✅ Query 1: Verify users table has all required columns
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY column_name;
```

Expected columns: `id`, `auth_uid`, `email`, `full_name`, `avatar_url`, `api_key`, `role`, `business_name`, `phone`, `plan_type`, `created_at`, `updated_at`

```sql
-- ✅ Query 2: Verify admin_access table exists and has correct structure
SELECT 
  column_name, 
  data_type
FROM information_schema.columns 
WHERE table_name = 'admin_access' 
ORDER BY column_name;
```

Expected columns: `id`, `user_id`, `workspace_id`, `role`, `created_at`, `updated_at`

```sql
-- ✅ Query 3: Verify employee_invites has expires_at
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'employee_invites' 
  AND column_name = 'expires_at'
) as has_expires_at;
```

Should return `true`.

```sql
-- ✅ Query 4: Test rpc_get_user_access exists
SELECT exists(
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'rpc_get_user_access'
) as rpc_exists;
```

Should return `true`.

```sql
-- ✅ Query 5: Check RLS is enabled on key tables
SELECT 
  schemaname, 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'admin_access', 'employees', 'employee_invites')
ORDER BY tablename;
```

All should have `rowsecurity = true`.

---

## Testing the Signup Flow

### Test Case 1: Sign Up a New Admin

1. **Frontend**: Navigate to `/auth/signup`
2. **Fill Form**:
   - Business Name: "Test Company"
   - Email: `testadmin@example.com`
   - Phone: `+1234567890`
   - Password: `TestPassword123!`
   - Plan: "Starter"
3. **Submit**
4. **Expected Result**: 
   - ✅ Auth user created
   - ✅ `users` row created with `role = NULL` (regular admin)
   - ✅ `workspaces` row created with owner = this user
   - ✅ `admin_access` row created with this user as admin
   - ✅ Redirects to `/dashboard`

### Test Case 2: Verify User Record

After signup, run:

```sql
SELECT 
  u.id,
  u.auth_uid,
  u.email,
  u.business_name,
  u.phone,
  u.plan_type,
  u.role,
  u.created_at
FROM public.users u
WHERE u.email = 'testadmin@example.com';
```

Expected:
- `role` = NULL
- `business_name` = "Test Company"
- `phone` = "+1234567890"
- `plan_type` = "starter"

### Test Case 3: Verify Admin Access

```sql
SELECT 
  aa.user_id,
  aa.workspace_id,
  aa.role,
  w.name
FROM public.admin_access aa
LEFT JOIN public.workspaces w ON w.id = aa.workspace_id
WHERE aa.user_id IN (
  SELECT id FROM public.users WHERE email = 'testadmin@example.com'
);
```

Expected: One row with `role = 'admin'` and a workspace_id pointing to the created workspace.

---

## Testing the Invite Flow

### Test Case 1: Create and Send Invite

1. **Frontend**: Login as admin, go to `/dashboard/employees`
2. **Click "Invite Employee"**
3. **Fill Form**:
   - Email: `employee@example.com`
   - (Optionally: First Name, Last Name)
4. **Submit**
5. **Expected Result**:
   - ✅ `employee_invites` row created with `status = 'pending'`
   - ✅ Token generated (random hex string)
   - ✅ Invite email sent (check backend logs)

### Test Case 2: Verify Invite Record

```sql
SELECT 
  id,
  workspace_id,
  email,
  token,
  status,
  expires_at,
  created_at
FROM public.employee_invites
WHERE email = 'employee@example.com'
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- `status` = "pending"
- `expires_at` = ~30 days from now
- `token` = hex string (32 chars)

### Test Case 3: Accept Invite

1. **Copy the invite token** from the above query
2. **Frontend**: Navigate to `/invite?token=<token>`
3. **Fill Form**:
   - Email: `employee@example.com` (must match invite)
   - First Name: "John"
   - Last Name: "Doe"
   - Password: `EmployeePass123!`
4. **Submit**
5. **Expected Result**:
   - ✅ Auth user created for employee
   - ✅ `users` row created with `role = NULL`
   - ✅ `employees` row created with `workspace_id` set
   - ✅ Invite status changed to "accepted"
   - ✅ Redirects to `/employee/dashboard`

### Test Case 4: Verify Employee Record

```sql
SELECT 
  e.id,
  e.user_id,
  e.workspace_id,
  e.full_name,
  e.phone,
  e.is_active,
  u.email
FROM public.employees e
JOIN public.users u ON u.id = e.user_id
WHERE u.email = 'employee@example.com';
```

Expected:
- `workspace_id` = the workspace the invite was for
- `full_name` = "John Doe"
- `is_active` = true

---

## Troubleshooting

### Problem: "Invalid or already used invite token"

**Cause**: Token lookup in `employee_invites` failed

**Fix**:
```sql
-- Check if invite exists
SELECT token, status, created_at, expires_at 
FROM public.employee_invites 
WHERE email = 'employee@example.com' 
LIMIT 1;

-- Ensure token column contains data
SELECT COUNT(*), MAX(LENGTH(token)) FROM public.employee_invites;
```

### Problem: "Email does not match the invitation"

**Cause**: Email comparison is case-sensitive or whitespace issue

**Fix**: The API now does case-insensitive comparison. Ensure:
- Frontend trims whitespace: `email.toLowerCase().trim()`
- Invite email is stored correctly: `SELECT email FROM public.employee_invites WHERE id = '...';`

### Problem: "User is already an admin and cannot be invited as employee"

**Cause**: User was already added to `admin_access` table

**Fix**: Check if user should be employee or admin:
```sql
SELECT * FROM public.admin_access 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email = 'user@example.com'
);
```

If they shouldn't be admin, delete from `admin_access`:
```sql
DELETE FROM public.admin_access 
WHERE user_id IN (
  SELECT id FROM public.users WHERE email = 'user@example.com'
);
```

### Problem: RPC function errors

**Check**: Verify RPC grant permissions
```sql
SELECT * FROM information_schema.routines 
WHERE routine_name IN (
  'rpc_create_user_profile',
  'rpc_accept_employee_invite',
  'rpc_get_user_access'
);
```

If missing, check migration ran without errors:
```bash
# Check logs
supabase functions list
```

### Problem: "User cannot be both admin and employee"

**Cause**: Trigger on employees table prevents both roles

**Fix**: This is intentional. A user can be:
- `admin` (via `admin_access` table)
- `employee` (via `employees` table)
- BUT NOT BOTH

Remove admin access first if promoting employee to admin:
```sql
DELETE FROM public.admin_access 
WHERE user_id = (SELECT id FROM public.users WHERE email = 'user@example.com');
```

---

## Data Consistency Checks

### Check 1: All admins have admin_access records

```sql
SELECT u.id, u.email 
FROM public.users u
WHERE u.role = 'super_admin' OR u.id IN (
  SELECT owner_id FROM public.workspaces
)
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_access aa WHERE aa.user_id = u.id
  );
```

Should return 0 rows.

### Check 2: No orphaned employees (workspace_id = NULL)

```sql
SELECT COUNT(*) as orphaned_count
FROM public.employees
WHERE workspace_id IS NULL;
```

Should return 0.

### Check 3: No duplicate admin_access records

```sql
SELECT user_id, workspace_id, COUNT(*)
FROM public.admin_access
GROUP BY user_id, workspace_id
HAVING COUNT(*) > 1;
```

Should return 0 rows.

### Check 4: All employees have exactly one workspace

```sql
SELECT COUNT(*) as multi_workspace_count
FROM (
  SELECT user_id
  FROM public.employees
  GROUP BY user_id
  HAVING COUNT(DISTINCT workspace_id) > 1
) t;
```

Should return 0.

### Check 5: All auth_uid links are valid

```sql
SELECT COUNT(*) as invalid_links
FROM public.users u
WHERE u.auth_uid IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users a WHERE a.id = u.auth_uid
  );
```

Should return 0.

---

## Rollback Instructions (If Needed)

If the migration causes issues, you can:

1. **Option A: Restore from backup**
   ```bash
   psql postgresql://user:password@db.supabase.co:5432/postgres \
     < backup_before_038.sql
   ```

2. **Option B: Manual rollback** (drops the migration's changes)
   ```sql
   -- DROP new columns added by 038
   ALTER TABLE public.users DROP COLUMN IF EXISTS role CASCADE;
   ALTER TABLE public.users DROP COLUMN IF EXISTS business_name CASCADE;
   ALTER TABLE public.users DROP COLUMN IF EXISTS phone CASCADE;
   ALTER TABLE public.users DROP COLUMN IF EXISTS plan_type CASCADE;
   
   -- Restore old RLS policies
   -- (See previous migration files for original policies)
   
   -- Drop RPC functions modified by 038
   DROP FUNCTION IF EXISTS public.rpc_get_user_access() CASCADE;
   DROP FUNCTION IF EXISTS public.rpc_create_user_profile(...) CASCADE;
   DROP FUNCTION IF EXISTS public.rpc_accept_employee_invite(...) CASCADE;
   ```

---

## What This Migration Enables

### After running this migration, these flows will work:

✅ **New Admin Signup**
- User signs up → Auth user created → Profile created → Workspace created → Can invite employees

✅ **Employee Invite**
- Admin invites employee → Invite sent → Employee clicks link → Employee profile created → Employee can login

✅ **Multi-Account Support**
- System supports unlimited users, workspaces, and employees
- Each user can belong to exactly ONE workspace (as employee) OR be admin of multiple workspaces
- Role hierarchy enforced: super_admin > admin > employee

✅ **RLS Security**
- Users can only see their own data
- Admins can only see workspace data they manage
- Employees can only see their own records
- Super admins can see everything (platform-wide)

✅ **Data Integrity**
- Cannot create employee without workspace
- Cannot be both admin and employee simultaneously  
- All auth_uid links are valid
- Invites expire after 30 days

---

## Next Steps After Migration

1. **Test signup flow** - Create a test admin account
2. **Test invite flow** - Invite an employee and accept
3. **Monitor logs** - Watch backend logs for any errors:
   ```bash
   tail -f /var/log/app.log | grep -E '\[SIGNUP\]|\[INVITE\]'
   ```
4. **Run data consistency checks** - Execute the checks above
5. **Deploy to production** - Once all tests pass

---

## Support & Questions

If you encounter issues:

1. **Check this guide** - Review troubleshooting section
2. **Check backend logs** - Look for error messages in `/api/` routes
3. **Run verification queries** - Ensure migration applied correctly
4. **Check database health** - Verify no constraint violations

For complex issues, enable debug logging:

```typescript
// In /app/api/employees/accept-invite/route.ts
console.log('[INVITE ACCEPT] Full debug info:', {
  tokenReceived: token,
  inviteFound: !!tokenCheckData,
  dbEmail: tokenCheckData?.email,
  requestEmail: email,
  // ... etc
});
```

Then check `supabase` logs:
```bash
supabase functions logs
```
