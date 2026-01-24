# Database Migration Guide: Signup & Invite Flows Fix

## Overview

This guide walks you through deploying the comprehensive fix for signup and invite flows in your Next.js + Supabase app. The migration ensures the database schema matches frontend expectations and enables proper multi-account support with role-based access control.

**Status**: ✅ Ready to deploy
**Migration File**: `supabase/migrations/038_comprehensive_signup_invite_fix.sql`
**Dependencies**: Migrations 029-037 must already be applied

---

## What This Migration Fixes

### Critical Issues Resolved

1. **Missing `role` Column in `users` Table**
   - Frontend checks `users.role = 'super_admin'` to detect platform admins
   - This column was missing, causing role detection to fail
   - **Fix**: Adds `role` column with CHECK constraint

2. **Missing Columns in `employees` Table**
   - Backend tries to insert `full_name` and `phone` on invite acceptance
   - These columns didn't exist, causing inserts to fail
   - **Fix**: Adds both columns with proper types

3. **Incomplete RLS Policies**
   - Some policies were missing or incomplete for multi-account support
   - Caused authorization failures for complex scenarios
   - **Fix**: Complete RLS coverage for all tables and operations

4. **Admin-Employee Dual Role Prevention**
   - Users should never be both admin and employee
   - Enforcement was incomplete at database level
   - **Fix**: Adds TRIGGER to prevent this at insert time

5. **Platform Workspace Setup**
   - Platform workspace (`00000000-0000-0000-0000-000000000001`) was missing
   - Used for platform_staff invites
   - **Fix**: Creates platform workspace if missing

---

## Pre-Migration Checklist

- [ ] Backup your Supabase database
- [ ] Verify migrations 029-037 have been applied
- [ ] No active users currently signing up or accepting invites
- [ ] Read the entire guide before starting

---

## Step 1: Apply the Migration in Supabase

### Option A: Via Supabase Dashboard (Web UI)

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to your project
3. Go to **SQL Editor** → **New Query**
4. Copy the entire contents of `supabase/migrations/038_comprehensive_signup_invite_fix.sql`
5. Paste into the query editor
6. Click **▶ Run** (top-right button)
7. Wait for completion (should take 5-10 seconds)
8. Verify no errors in the output panel

### Option B: Via Supabase CLI

```bash
# Navigate to your project directory
cd /path/to/retail-assist

# Apply migrations (this runs all pending migrations including 038)
supabase db push

# Or apply only migration 038 if others are already applied
supabase migration list  # Check status
```

### Option C: Via Docker/Container

If using Supabase locally:

```bash
# Copy migration file to your Supabase migrations folder
cp supabase/migrations/038_comprehensive_signup_invite_fix.sql path/to/local/supabase/migrations/

# Reset database with all migrations
supabase db reset

# Or apply with:
psql -h localhost -U postgres -d postgres -f supabase/migrations/038_comprehensive_signup_invite_fix.sql
```

---

## Step 2: Verify Migration Success

After running the migration, verify these components exist and are correct:

### 2.1: Check Tables Exist

Run in Supabase SQL Editor:

```sql
-- Verify all required tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'workspaces', 'employees', 
    'employee_invites', 'admin_access'
  )
ORDER BY table_name;

-- Expected result: 5 rows (all tables present)
```

### 2.2: Check users Table Has role Column

```sql
-- Verify users.role exists and has correct type
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'role';

-- Expected: TEXT, NOT NULL, default 'user'
```

### 2.3: Check employees Table Has New Columns

```sql
-- Verify employees table has full_name and phone
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'employees'
  AND column_name IN ('full_name', 'phone', 'workspace_id')
ORDER BY column_name;

-- Expected: 3 rows with TEXT and UUID types
```

### 2.4: Check employee_invites Has expires_at

```sql
-- Verify employee_invites.expires_at exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'employee_invites' 
  AND column_name = 'expires_at';

-- Expected: TIMESTAMP WITH TIME ZONE, default (now() + 30 days)
```

### 2.5: Check admin_access Table

```sql
-- Verify admin_access exists with correct structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_access'
ORDER BY ordinal_position;

-- Expected columns: id, user_id, workspace_id, role, created_at, updated_at
```

### 2.6: Check Platform Workspace Exists

```sql
-- Verify platform workspace was created
SELECT id, name, owner_id
FROM public.workspaces
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Expected: 1 row with name 'Platform'
```

### 2.7: Check Constraints and Indexes

```sql
-- Verify unique constraint on employees (single workspace per user)
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'employees'
  AND constraint_name LIKE '%employee%';

-- Expected: uniq_employee_single_workspace unique constraint
```

### 2.8: Check RLS Is Enabled

```sql
-- Verify RLS is enabled on all required tables
SELECT tablename, 
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('users', 'workspaces', 'employees', 
                    'employee_invites', 'admin_access', 'workspace_members')
ORDER BY tablename;

-- Expected: All tables should have policy_count > 0
```

---

## Step 3: Populate Initial Data

### 3.1: Ensure Super Admin Exists

If you don't have a super admin user yet, create one:

```sql
-- Check if super admin exists
SELECT id, email, role FROM public.users WHERE role = 'super_admin';

-- If empty, create super admin (insert into auth first, then users table)
-- Use Supabase Auth API to create auth.users entry, then insert to users table
```

**For development**: Use Supabase Dashboard → **Auth Users** to create a test admin:
- Email: `super@retailassist.com`
- Password: Choose a secure password

Then in SQL:
```sql
-- Get the auth_uid from Supabase Auth (visible in Auth Users table)
-- Then insert to users table
INSERT INTO public.users (auth_uid, email, full_name, role)
VALUES (
  'YOUR_AUTH_UID_HERE',  -- Copy from Auth Users table
  'super@retailassist.com',
  'Super Admin',
  'super_admin'
)
ON CONFLICT (email) DO UPDATE SET role = 'super_admin';

-- Add to admin_access
INSERT INTO public.admin_access (user_id, workspace_id, role)
SELECT id, NULL, 'super_admin'
FROM public.users
WHERE email = 'super@retailassist.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_access
    WHERE user_id = (SELECT id FROM public.users WHERE email = 'super@retailassist.com')
      AND workspace_id IS NULL
  );
```

### 3.2: Verify Workspace Owners Are Admins

```sql
-- Check that all workspace owners are in admin_access
SELECT 
  w.id,
  w.name,
  w.owner_id,
  u.email,
  (SELECT COUNT(*) FROM public.admin_access aa 
   WHERE aa.user_id = w.owner_id AND aa.workspace_id = w.id) as is_admin
FROM public.workspaces w
JOIN public.users u ON u.id = w.owner_id
WHERE w.id != '00000000-0000-0000-0000-000000000001'::uuid;

-- If is_admin = 0 for any row, add them:
INSERT INTO public.admin_access (user_id, workspace_id, role)
SELECT w.owner_id, w.id, 'admin'
FROM public.workspaces w
WHERE w.id != '00000000-0000-0000-0000-000000000001'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = w.owner_id AND aa.workspace_id = w.id
  );
```

---

## Step 4: Test the Signup and Invite Flows

### 4.1: Test Scenario 1 - Admin Invites Employee

**Setup**: You have a client admin account

**Test Steps**:
1. Log in as admin at `/auth/login`
2. Navigate to workspace dashboard
3. Go to **Employees** section
4. Click **Invite Team Member**
5. Enter a test email: `testemployee@example.com`
6. Click **Send Invite**

**Expected Result**:
- ✅ Invite created successfully
- ✅ Response shows `{ success: true, invite: { id, token } }`
- ✅ Check database: `SELECT * FROM public.employee_invites WHERE email = 'testemployee@example.com';`
- ✅ Should see 1 row with status 'pending' and a valid token

**Debug If Failed**:
```bash
# Check server logs for errors
# Look for messages like "[/api/employees POST]"

# Check if RPC returns correct role
supabase sql -c "SELECT * FROM public.rpc_get_user_access();"
# Should return: role = 'admin', workspace_id = '<your-workspace-id>'

# Check if admin has access in admin_access table
supabase sql -c "SELECT * FROM public.admin_access WHERE user_id = '<admin-user-id>';"
```

### 4.2: Test Scenario 2 - Employee Accepts Invite

**Test Steps**:
1. Copy the invite token from Step 4.1
2. Navigate to: `https://your-app.com/invite?token=<TOKEN>`
3. Fill in the form:
   - Email: `testemployee@example.com`
   - First Name: `Test`
   - Last Name: `Employee`
   - Password: `TestPassword123!`
4. Click **Accept Invite**

**Expected Result**:
- ✅ Account created successfully
- ✅ Redirected to `/employees/dashboard`
- ✅ Response shows `{ success: true, role: 'employee', workspace_id: '<id>' }`
- ✅ Check database:
  ```sql
  SELECT * FROM public.employees 
  WHERE user_id = (SELECT id FROM public.users WHERE email = 'testemployee@example.com');
  ```
  - Should see 1 row with workspace_id and full_name = 'Test Employee'

**Debug If Failed**:
```bash
# Check invite status
supabase sql -c "SELECT * FROM public.employee_invites WHERE email = 'testemployee@example.com';"
# Should see status = 'pending' (until accepted)

# Check auth user was created
supabase auth list  # See if testemployee@example.com appears

# Check users table
supabase sql -c "SELECT * FROM public.users WHERE email = 'testemployee@example.com';"
# Should see 1 row with auth_uid filled in

# Check RLS allows read
supabase sql -c "SELECT * FROM public.employees WHERE id = '<id>';"
# If empty/error, RLS is blocking
```

### 4.3: Test Scenario 3 - Multi-Account Support

**Test Steps**:
1. Create **Client A** with admin: `adminA@company.com`
2. Create **Client B** with admin: `adminB@company.com`
3. Each admin invites one employee to their workspace
4. Both employees accept invites

**Expected Result**:
- ✅ `employeeA@company.com` can only access Client A's workspace
- ✅ `employeeB@company.com` can only access Client B's workspace
- ✅ Each employee can log in and see only their workspace data
- ✅ Middleware correctly routes them to `/employees/dashboard`

**Verify in Database**:
```sql
-- Check that employees are in different workspaces
SELECT u.email, e.workspace_id, w.name
FROM public.employees e
JOIN public.users u ON u.id = e.user_id
JOIN public.workspaces w ON w.id = e.workspace_id
WHERE u.email IN ('employeeA@company.com', 'employeeB@company.com')
ORDER BY u.email;

-- Should see 2 rows with different workspace_ids
```

---

## Step 5: Verify Data Integrity

Run these queries to ensure no data consistency issues:

```sql
-- 1. Check for employees who are also admins (should be 0)
SELECT COUNT(*) as error_count
FROM public.employees e
WHERE EXISTS (
  SELECT 1 FROM public.admin_access aa
  WHERE aa.user_id = e.user_id
);
-- Expected: 0

-- 2. Check for multi-workspace employees (should be 0)
SELECT user_id, COUNT(*) as workspace_count
FROM public.employees
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 3. Check for employees without workspace_id (should be 0)
SELECT COUNT(*) as error_count
FROM public.employees
WHERE workspace_id IS NULL;
-- Expected: 0

-- 4. Check that all workspace owners are in admin_access
SELECT COUNT(*) as unlinked_owners
FROM public.workspaces w
WHERE w.id != '00000000-0000-0000-0000-000000000001'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = w.owner_id AND aa.workspace_id = w.id
  );
-- Expected: 0

-- 5. Check that platform workspace has correct owner
SELECT id, name, owner_id
FROM public.workspaces
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
-- Expected: 1 row (should exist)

-- 6. Check RLS on admin_access is enabled
SELECT tablename, (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'admin_access') as policy_count
FROM pg_tables
WHERE tablename = 'admin_access';
-- Expected: policy_count > 0
```

---

## Step 6: Deploy to Production (Optional)

### Prerequisites

- [ ] All tests passed locally
- [ ] Super admin created and verified
- [ ] No active signup/invite operations in progress
- [ ] Database backup exists

### Production Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Verify migrations are available
supabase migration list

# 3. Deploy migrations to production
supabase db push --linked

# 4. Verify in production
# - Check Supabase dashboard for the new migration
# - Run verification queries (Step 2 above)

# 5. Monitor logs
# - Watch /api/employees POST logs
# - Watch /api/employees/accept-invite POST logs
# - Check for any RLS errors
```

---

## Troubleshooting

### Problem: Migration Fails with "Table Already Exists"

**Solution**: The `IF NOT EXISTS` clauses handle this. Run the migration again—it's idempotent.

### Problem: RLS Policy Errors on Accept

**Cause**: Service role key might not be set in `.env.local`

**Solution**:
```bash
# Check environment variables
echo $SUPABASE_SERVICE_ROLE_KEY

# If empty, add to .env.local
SUPABASE_SERVICE_ROLE_KEY=your-key-here
```

### Problem: "User is already an employee in another workspace"

**Cause**: User already has an `employees` record. This is the expected behavior—enforces single workspace.

**Solution**: For testing, delete the old employee record:
```sql
DELETE FROM public.employees WHERE user_id = '<user-id>';
```

### Problem: Email Mismatch on Accept

**Cause**: Email in request doesn't match invite email exactly (case-sensitive or typo)

**Solution**: Check invite email:
```sql
SELECT email FROM public.employee_invites WHERE token = '<token>';
```

And ensure the user enters the exact same email.

### Problem: "Invalid or expired invite token"

**Cause**: Token doesn't exist or is already accepted/revoked

**Solution**: Verify token format and status:
```sql
SELECT id, status, token, created_at, expires_at
FROM public.employee_invites
WHERE token LIKE '%<partial-token>%'
LIMIT 5;
```

### Problem: RLS Blocking Legitimate Access

**Debug**:
```sql
-- Check current user
SELECT auth.uid();

-- Check user's role
SELECT * FROM public.rpc_get_user_access();

-- Check admin_access
SELECT * FROM public.admin_access WHERE user_id = '<user-id>';

-- Check if policy allows access
-- (Manually trace through the policy logic)
```

---

## Rollback Instructions (If Needed)

If you need to rollback, you have two options:

### Option 1: Rollback via Supabase Dashboard

1. Go to **SQL Editor** → **New Query**
2. Run this query to remove the new columns (preserving data):
   ```sql
   ALTER TABLE public.employees DROP COLUMN IF EXISTS full_name;
   ALTER TABLE public.employees DROP COLUMN IF EXISTS phone;
   ALTER TABLE public.users DROP COLUMN IF EXISTS role;
   ```
3. The rest (admin_access, RLS) can stay—they're backward compatible

### Option 2: Full Database Reset

```bash
supabase db reset  # Resets to all migrations except 038
# Then manually remove migration 038 file
rm supabase/migrations/038_comprehensive_signup_invite_fix.sql
```

---

## Support & Questions

If you encounter issues:

1. **Check the verification queries above** (Step 2)
2. **Review troubleshooting section** above
3. **Check Supabase logs**: Dashboard → **Logs** → **API** and **Database**
4. **Check application logs**: Look for `[/api/employees` messages

---

## Summary of Changes

| Component | Change | Impact |
|-----------|--------|--------|
| `users.role` | Added column | Enables super_admin detection |
| `employees.full_name` | Added column | Stores employee name from invite |
| `employees.phone` | Added column | Stores employee phone from invite |
| `admin_access` | Ensured exists | Tracks workspace admins |
| RLS Policies | Updated/Enhanced | Allows proper multi-account access |
| Platform Workspace | Created | Used for platform_staff invites |
| Triggers | Added | Prevents admin+employee dual roles |
| Indexes | Added | Improves query performance |

---

**Migration Status**: ✅ Ready for Production
**Last Updated**: January 22, 2026
**Tested With**: Next.js 14.x, Supabase PosgRES 15.x
