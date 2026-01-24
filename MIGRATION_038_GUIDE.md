# Database Migration Guide: Fix Signup & Invite Flows (Migration 038)

## Overview

Migration **038_comprehensive_schema_fix.sql** fixes critical issues that prevent signup and invite flows from working with multi-account support. After this migration, new users can:

1. ✅ Sign up with a Supabase auth account
2. ✅ Create a workspace and become its owner/admin
3. ✅ Invite other employees to their workspace
4. ✅ Employees can accept invites and create accounts
5. ✅ All RLS policies properly enforce workspace scoping
6. ✅ Multiple workspaces and accounts are supported

---

## Problems Fixed

### 1. **Missing `role` Column on `users` Table**
- **Issue**: Code references `u.role` to check for `super_admin`, but the column doesn't exist
- **Impact**: Super admin checks fail; cannot identify platform admins
- **Fix**: Add `role` column with values: `'user'`, `'super_admin'`

### 2. **Employees Table Uses Wrong FK (`business_id` Instead of `workspace_id`)**
- **Issue**: Table has `business_id` but API sends `workspace_id`
- **Impact**: Accept-invite flow fails when creating employee record
- **Fix**: 
  - Add `workspace_id` column
  - Migrate existing data from `business_id`
  - Create new unique constraint on `(user_id, workspace_id)`

### 3. **Employees Table Missing `role` and `full_name` Columns**
- **Issue**: Accept-invite API tries to insert `role: 'employee'` and `full_name` but columns don't exist
- **Impact**: Employee creation fails with "column does not exist" error
- **Fix**: Add `role` and `full_name` columns to match API expectations

### 4. **RLS Policies Not Scoped for Multi-Account Support**
- **Issue**: Existing policies don't properly enforce workspace isolation
- **Impact**: Users can see/access workspaces they don't belong to
- **Fix**: Update RLS policies on all tables to use `admin_access` table for authorization

### 5. **Auth User Creation Doesn't Auto-Create User Records**
- **Issue**: When Supabase creates `auth.users`, no corresponding `public.users` row is created
- **Impact**: User lookups fail; FK constraints break; signup flow errors
- **Fix**: Add trigger on `auth.users` INSERT to auto-create `public.users` record

### 6. **Admin Access Not Seeded for Workspace Owners**
- **Issue**: Workspace owners aren't in the `admin_access` table
- **Impact**: Owner queries fail when checking admin status
- **Fix**: Migrate existing workspace owners to `admin_access` table with `role='admin'`

---

## Migration Steps

### Step 1: Backup Your Database

**Before running the migration, back up your Supabase database:**

```bash
# In Supabase dashboard:
# 1. Go to Database → Backups
# 2. Click "Create backup" (manual backup)
# 3. Wait for backup to complete
```

Alternatively, export data:
```bash
# Export current employees and admin_access data
pg_dump --host <host> --port 5432 --username postgres --password \
  --dbname postgres --table public.employees --table public.admin_access \
  > backup_employees_admins_$(date +%s).sql
```

### Step 2: Run the Migration

**Option A: Via Supabase Dashboard (Recommended for Testing)**

1. Go to **SQL Editor**
2. Create a new query
3. Copy the entire content of `038_comprehensive_schema_fix.sql`
4. Paste into the SQL Editor
5. Click **Run**
6. Wait for completion (should take < 30 seconds)

**Option B: Via CLI**

```bash
cd /workspaces/retail-assist

# If using Supabase CLI
supabase migration up

# Or manually via psql
psql "postgresql://$SUPABASE_USER:$SUPABASE_PASSWORD@$SUPABASE_HOST:5432/postgres" \
  < supabase/migrations/038_comprehensive_schema_fix.sql
```

### Step 3: Verify Migration Success

Run these queries in Supabase SQL Editor to confirm everything is correct:

```sql
-- 1. Verify users table has role column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'role';
-- Expected: 'role' column of type 'text' with default 'user'

-- 2. Verify employees table has required columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'employees'
  AND column_name IN ('workspace_id', 'role', 'full_name')
ORDER BY ordinal_position;
-- Expected: workspace_id (uuid), role (text), full_name (text)

-- 3. Verify admin_access table exists
SELECT COUNT(*) as admin_access_count FROM public.admin_access;
-- Expected: >= 1 row (at least workspace owners should be present)

-- 4. Verify workspace owners are in admin_access
SELECT COUNT(*) as owner_admin_count
FROM public.workspaces w
JOIN public.admin_access aa ON w.owner_id = aa.user_id AND w.id = aa.workspace_id;
-- Expected: equals number of workspaces

-- 5. Verify auth trigger was created
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'handle_auth_user_created'
  AND routine_schema = 'public';
-- Expected: one row with 'handle_auth_user_created'

-- 6. Verify RLS policies exist on key tables
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('admin_access', 'employees', 'employee_invites')
ORDER BY tablename, policyname;
-- Expected: multiple policies per table
```

---

## Testing the Complete Flow

### Test 1: Signup → Create Workspace

**Frontend:**
1. Go to `/auth/signup`
2. Fill in: email, password, business name, phone, select plan
3. Submit

**Backend should:**
1. Create `auth.users` record
2. Trigger auto-creates `public.users` record with `auth_uid`
3. RPC creates workspace with owner = this user
4. RPC creates `admin_access` with role='admin' for this workspace

**Verify:**
```sql
-- Should find the new user
SELECT u.id, u.email, u.role, w.id as workspace_id, w.name
FROM public.users u
LEFT JOIN public.workspaces w ON w.owner_id = u.id
WHERE u.email = 'test@example.com';

-- Should find admin_access entry
SELECT * FROM public.admin_access
WHERE workspace_id IN (
  SELECT id FROM public.workspaces 
  WHERE owner_id IN (SELECT id FROM public.users WHERE email = 'test@example.com')
);
```

### Test 2: Create Invite → Accept Invite

**Frontend (Admin):**
1. Sign in as workspace owner
2. Go to Employees or Admin panel
3. Click "Invite Employee"
4. Enter employee email
5. Send invite (generates invite token)

**Backend should:**
1. Create `employee_invites` record with:
   - `workspace_id` = admin's workspace
   - `email` = invitee email
   - `token` = unique secure token
   - `status` = 'pending'
   - `invited_by` = admin's user_id

**Frontend (Employee):**
1. Employee receives invite email with link: `/invite?token=<TOKEN>`
2. Clicks link, sees form
3. Fills: email, first_name, last_name, password
4. Submits to `/api/employees/accept-invite?token=<TOKEN>`

**Backend should:**
1. Validate token exists and matches email
2. Create `auth.users` (if email is new)
3. Create/update `public.users` with auth_uid
4. Create `employees` record with `workspace_id` = invite's workspace
5. Update `employee_invites.status` = 'accepted'
6. Return `{ success: true, workspace_id, user_id }`

**Verify:**
```sql
-- Invite created
SELECT id, email, status, created_at FROM public.employee_invites
WHERE email = 'employee@example.com'
ORDER BY created_at DESC LIMIT 1;

-- After acceptance, check employees table
SELECT e.id, e.user_id, e.workspace_id, e.role, u.email
FROM public.employees e
JOIN public.users u ON e.user_id = u.id
WHERE u.email = 'employee@example.com';

-- Verify invite is marked accepted
SELECT status, accepted_at FROM public.employee_invites
WHERE email = 'employee@example.com'
ORDER BY created_at DESC LIMIT 1;
```

### Test 3: RLS Policy Enforcement

**Setup:**
- User A (Admin of Workspace 1)
- User B (Employee of Workspace 1)  
- User C (Admin of Workspace 2)
- User D (No workspace access)

**Test:** User D tries to read Workspace 1 employees via API

```sql
-- Simulate User D querying employees in Workspace 1
-- This should return NO rows due to RLS policy
SELECT e.* FROM public.employees e
WHERE e.workspace_id = '<workspace_1_id>';
-- Expected: 0 rows (User D not in admin_access for Workspace 1)
```

---

## Rollback Plan

If the migration causes issues, follow these steps:

### Option 1: Restore from Backup (Safest)

1. Go to Supabase Dashboard → Database → Backups
2. Find the backup taken before migration
3. Click "Restore from this backup"
4. Wait for restoration to complete
5. Verify data is restored

### Option 2: Reverse Changes (If No Backup)

```sql
-- Remove new admin_access entries from this migration
DELETE FROM public.admin_access
WHERE created_at > '<migration_timestamp>';

-- Drop new columns from employees
ALTER TABLE public.employees DROP COLUMN IF EXISTS workspace_id CASCADE;
ALTER TABLE public.employees DROP COLUMN IF EXISTS role;
ALTER TABLE public.employees DROP COLUMN IF EXISTS full_name;

-- Remove auth trigger
DROP TRIGGER IF EXISTS trigger_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_created();

-- Revert RLS policies (drop new ones, restore old ones from git history)
-- This requires manual restoration from previous migration
```

---

## Troubleshooting

### Issue: "column does not exist" when creating employee

**Error Message:** `ERROR: column "workspace_id" of relation "employees" does not exist`

**Solution:**
1. Verify migration ran completely: `SELECT version FROM schema_migrations WHERE name = '038_comprehensive_schema_fix';`
2. If migration is missing, run it manually
3. Verify column exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'workspace_id';`

### Issue: Invite acceptance fails with "user not found"

**Error Message:** `Unable to resolve user profile` or `Inviter not found`

**Solution:**
1. Check auth trigger is active: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_auth_user_created';`
2. Verify `public.users` record exists for auth user: `SELECT u.id FROM public.users u WHERE u.auth_uid = '<auth_uid>';`
3. If missing, manually create: `INSERT INTO public.users (auth_uid, email) VALUES ('<auth_uid>', '<email>');`

### Issue: "Inviter must be a client admin" error

**Error Message:** `Inviter must be a client admin to invite employees`

**Solution:**
1. Verify workspace owner is in `admin_access`: 
   ```sql
   SELECT * FROM public.admin_access
   WHERE user_id = '<owner_id>' AND role = 'admin';
   ```
2. If missing, manually add:
   ```sql
   INSERT INTO public.admin_access (user_id, workspace_id, role)
   VALUES ('<owner_id>', '<workspace_id>', 'admin')
   ON CONFLICT DO NOTHING;
   ```

### Issue: RLS policy blocks authenticated user

**Error Message:** `new row violates row-level security policy` or `0 rows returned`

**Solution:**
1. Check user has admin_access: 
   ```sql
   SELECT * FROM public.admin_access
   WHERE user_id = '<user_id>' AND workspace_id = '<workspace_id>';
   ```
2. If missing, add via admin panel or database:
   ```sql
   INSERT INTO public.admin_access (user_id, workspace_id, role)
   VALUES ('<user_id>', '<workspace_id>', 'admin');
   ```

### Issue: Super admin tests fail

**Solution:**
1. Verify super_admin record exists:
   ```sql
   SELECT u.id, u.email, u.role, aa.workspace_id, aa.role as admin_role
   FROM public.users u
   LEFT JOIN public.admin_access aa ON u.id = aa.user_id
   WHERE u.role = 'super_admin';
   ```
2. If missing, manually seed:
   ```sql
   UPDATE public.users SET role = 'super_admin'
   WHERE email = '<super_admin_email>';
   
   INSERT INTO public.admin_access (user_id, workspace_id, role)
   SELECT u.id, NULL, 'super_admin'
   FROM public.users u
   WHERE u.role = 'super_admin'
   ON CONFLICT DO NOTHING;
   ```

---

## Data Consistency Checks

Run these queries periodically to detect issues:

```sql
-- 1. Find orphaned employees (no corresponding user)
SELECT e.id, e.user_id FROM public.employees e
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = e.user_id);
-- Expected: 0 rows

-- 2. Find employees missing workspace
SELECT e.id, e.user_id FROM public.employees e
WHERE e.workspace_id IS NULL;
-- Expected: 0 rows

-- 3. Find users in multiple workspaces as employees
SELECT e.user_id, COUNT(DISTINCT e.workspace_id) as workspace_count
FROM public.employees e
GROUP BY e.user_id
HAVING COUNT(DISTINCT e.workspace_id) > 1;
-- Expected: 0 rows

-- 4. Find admin_access records pointing to deleted users
SELECT aa.id, aa.user_id FROM public.admin_access aa
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = aa.user_id);
-- Expected: 0 rows

-- 5. Find admin_access records pointing to deleted workspaces
SELECT aa.id, aa.workspace_id FROM public.admin_access aa
WHERE aa.workspace_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = aa.workspace_id);
-- Expected: 0 rows

-- 6. Find workspace owners not in admin_access
SELECT w.id, w.owner_id, w.name FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_access aa
  WHERE aa.user_id = w.owner_id
    AND aa.workspace_id = w.id
);
-- Expected: 0 rows
```

---

## Migration Impact Summary

| Component | Changes | Impact |
|-----------|---------|--------|
| **users** | Added `role` column | Enables super_admin tracking |
| **employees** | Added `workspace_id`, `role`, `full_name`; fixed FK | Fixes accept-invite flow; enables multi-workspace support |
| **admin_access** | Ensured it exists; seeded with workspace owners | Enables authorization checks |
| **auth trigger** | Added auto-creation of user records | Fixes signup flow |
| **RLS policies** | Updated all tables for workspace scoping | Enables multi-account support |
| **RPC functions** | Updated `rpc_get_user_access` | Returns single workspace for single-workspace admins |

---

## Next Steps After Migration

1. **Test signup flow** with a test email
2. **Test invite flow** by creating and accepting an invite
3. **Test multi-account** by creating second workspace from different browser/session
4. **Update frontend docs** to reflect any URL parameter changes
5. **Monitor logs** for RLS violations: check Supabase Logs → Auth or Network tabs

---

## Support & Rollback

If you encounter issues:

1. Check the Verification Queries section above
2. Review Troubleshooting section
3. If stuck, you can rollback using the Rollback Plan section
4. The backup from Step 1 ensures you can always restore to a known-good state

---

## File Locations

- **Migration file**: `/workspaces/retail-assist/supabase/migrations/038_comprehensive_schema_fix.sql`
- **This guide**: `/workspaces/retail-assist/MIGRATION_038_GUIDE.md`
- **Frontend code**:
  - Signup: `app/auth/signup/page.tsx`, `app/api/auth/signup/route.ts`
  - Invite: `app/invite/page.tsx`, `app/api/employees/accept-invite/route.ts`
  - Employees API: `app/api/employees/route.ts`
