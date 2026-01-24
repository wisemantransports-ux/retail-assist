# Migration 038 Execution Checklist

Use this checklist to execute the migration safely and verify it worked.

---

## Pre-Migration (Do Before Running SQL)

- [ ] **1. Read the audit report**
  - Read: `SCHEMA_AUDIT_REPORT.md`
  - Understand: What was wrong and why

- [ ] **2. Create database backup**
  - Supabase Dashboard → Database → Backups
  - Click: "Create backup"
  - Wait until status shows "Complete"
  - Record backup time: ________________

- [ ] **3. Notify team (if production)**
  - Message: "Database migration in progress"
  - Time window: 5 minutes
  - Impact: Signup/invite flows will be temporarily affected

- [ ] **4. Read migration file**
  - Open: `supabase/migrations/038_comprehensive_schema_fix.sql`
  - Review: All SQL statements
  - Confirm: You understand the changes

---

## Execute Migration

- [ ] **5. Open SQL Editor**
  - Supabase Dashboard → SQL Editor
  - Click: "New Query"

- [ ] **6. Copy migration SQL**
  - Open file: `supabase/migrations/038_comprehensive_schema_fix.sql`
  - Select all (Ctrl+A)
  - Copy (Ctrl+C)

- [ ] **7. Paste into SQL Editor**
  - Click in SQL editor window
  - Paste (Ctrl+V)
  - Verify: All content is there (lots of SQL statements)

- [ ] **8. Run migration**
  - Click: "Run" button
  - Wait: Query executing... (should take < 30 seconds)
  - Check: Message shows "Query successful" (or similar)
  - If error: See "Troubleshooting" section below

- [ ] **9. Record execution time**
  - Execution started: ________________
  - Execution completed: ________________
  - Status: ✅ SUCCESS or ❌ FAILED

---

## Post-Migration Verification

### Quick Verification (2 minutes)

- [ ] **10. Run quick check query**

```sql
-- Verify 3 critical fixes
SELECT 
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'users' AND column_name = 'role') as has_role_column,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'employees' AND column_name = 'workspace_id') as has_workspace_id,
  (SELECT COUNT(*) FROM public.admin_access) as admin_access_rows;
```

- [ ] Result shows: `3 | 1 | ≥1`
  - First value is 3: ✅
  - Second value is 1: ✅
  - Third value is ≥ 1: ✅

### Complete Verification (5 minutes)

Run each verification query and confirm expected results:

- [ ] **11. users table has role column**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'role';
```

Expected: One row with `role | text | 'user'::text`

- [ ] **12. employees table has workspace_id**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'employees' AND column_name = 'workspace_id';
```

Expected: One row with `workspace_id | uuid | NO`

- [ ] **13. employees table has role column**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'employees' AND column_name = 'role';
```

Expected: One row with `role`

- [ ] **14. employees table has full_name column**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'employees' AND column_name = 'full_name';
```

Expected: One row with `full_name`

- [ ] **15. admin_access table exists with data**

```sql
SELECT COUNT(*) as record_count FROM public.admin_access;
```

Expected: ≥ 1 (should have workspace owners)

- [ ] **16. Auth trigger was created**

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'handle_auth_user_created';
```

Expected: One row with `handle_auth_user_created`

- [ ] **17. RLS policies exist**

```sql
SELECT COUNT(DISTINCT tablename) as table_count
FROM pg_policies
WHERE tablename IN ('admin_access', 'employees', 'users', 'workspaces', 'employee_invites');
```

Expected: 5 (or more, means all tables have RLS)

- [ ] **18. Workspace owners are in admin_access**

```sql
SELECT COUNT(*) as owner_admin_count
FROM public.workspaces w
JOIN public.admin_access aa ON w.owner_id = aa.user_id AND w.id = aa.workspace_id
WHERE aa.role = 'admin';
```

Expected: Equal to number of workspaces

- [ ] **19. No orphaned admin_access records**

```sql
SELECT COUNT(*) as orphaned_count FROM public.admin_access aa
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = aa.user_id)
  OR (aa.workspace_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = aa.workspace_id));
```

Expected: 0

---

## Functional Testing (10 minutes)

### Test 1: Signup Flow

- [ ] **20. Create test account**
  - Go to: `/auth/signup`
  - Email: `test-$(date +%s)@example.com` (unique)
  - Password: `Test1234!`
  - Business Name: `Test Business`
  - Phone: `+1234567890`
  - Plan: `Starter`
  - Submit

- [ ] Expected result:
  - [ ] No errors in frontend console
  - [ ] Page redirects to dashboard
  - [ ] Workspace is created
  - [ ] New user can see their workspace

- [ ] **21. Verify in database**

```sql
SELECT u.id, u.email, u.role, w.id as workspace_id, w.name
FROM public.users u
LEFT JOIN public.workspaces w ON w.owner_id = u.id
WHERE u.email = 'test-<timestamp>@example.com';
```

Expected: One row with workspace created

- [ ] **22. Verify admin_access seeded**

```sql
SELECT aa.* FROM public.admin_access aa
JOIN public.users u ON aa.user_id = u.id
WHERE u.email = 'test-<timestamp>@example.com';
```

Expected: One row with role='admin'

### Test 2: Invite Flow

- [ ] **23. Send invite (as admin)**
  - Sign in with account from Test 1
  - Go to: Employees (or Admin → Invitations)
  - Enter email: `employee-$(date +%s)@example.com`
  - Send invite

- [ ] Expected:
  - [ ] No database errors in Supabase logs
  - [ ] Invite appears in list as "pending"
  - [ ] Invite link contains `token=...`

- [ ] **24. Verify invite in database**

```sql
SELECT id, email, status, token FROM public.employee_invites
WHERE email = 'employee-<timestamp>@example.com'
ORDER BY created_at DESC LIMIT 1;
```

Expected: One pending invite with a token

- [ ] **25. Accept invite (as employee)**
  - Open invite link: `/invite?token=<TOKEN>`
  - Fill form:
    - Email: `employee-<timestamp>@example.com`
    - First Name: `Test`
    - Last Name: `Employee`
    - Password: `Test1234!`
  - Submit

- [ ] Expected:
  - [ ] No errors
  - [ ] Page shows success message
  - [ ] Page redirects to workspace dashboard
  - [ ] Employee can see the workspace

- [ ] **26. Verify employee created**

```sql
SELECT e.id, e.user_id, e.workspace_id, e.role, u.email
FROM public.employees e
JOIN public.users u ON e.user_id = u.id
WHERE u.email = 'employee-<timestamp>@example.com';
```

Expected: One row with role='employee'

- [ ] **27. Verify invite marked accepted**

```sql
SELECT status, accepted_at, full_name FROM public.employee_invites
WHERE email = 'employee-<timestamp>@example.com'
ORDER BY created_at DESC LIMIT 1;
```

Expected: status='accepted', accepted_at=now(), full_name='Test Employee'

### Test 3: RLS / Multi-Account Isolation

- [ ] **28. Verify admin can't see other workspaces**
  - Sign in as first test user (workspace 1 admin)
  - Try to list employees from workspace 2 (should fail or return empty)

```sql
-- Simulate first user querying second workspace
SELECT COUNT(*) FROM public.employees
WHERE workspace_id = '<workspace2_id>';
```

- [ ] **29. Verify employee can only see their workspace**
  - Expected: Employee from workspace 1 cannot access workspace 2 data

---

## Documentation

- [ ] **30. Update team notes**
  - Record what worked: ________________
  - Record any issues: ________________
  - Record solutions applied: ________________

- [ ] **31. Archive this checklist**
  - Rename to: `MIGRATION_038_EXECUTED_<date>.txt`
  - Save in: `/workspaces/retail-assist/`

---

## Troubleshooting

### ❌ Error: "column does not exist"

- [ ] Check migration ran completely: `SELECT * FROM schema_migrations WHERE name = '038_comprehensive_schema_fix';`
- [ ] Manually verify column: `SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'workspace_id';`
- [ ] If missing, re-run migration

### ❌ Error: "Inviter must be a client admin"

- [ ] Check workspace owner is in admin_access:
  ```sql
  SELECT * FROM public.admin_access
  WHERE user_id = '<owner_id>' AND role = 'admin';
  ```
- [ ] If missing, insert manually:
  ```sql
  INSERT INTO public.admin_access (user_id, workspace_id, role)
  VALUES ('<owner_id>', '<workspace_id>', 'admin');
  ```

### ❌ Signup RPC fails

- [ ] Check auth trigger exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'handle_auth_user_created';`
- [ ] Check public.users record was auto-created:
  ```sql
  SELECT u.id FROM public.users u WHERE u.auth_uid = '<auth_uid>';
  ```
- [ ] If missing, manually insert:
  ```sql
  INSERT INTO public.users (auth_uid, email)
  VALUES ('<auth_uid>', '<email>')
  ON CONFLICT (auth_uid) DO NOTHING;
  ```

### ❌ RLS blocks valid user

- [ ] Check admin_access has the user:
  ```sql
  SELECT * FROM public.admin_access
  WHERE user_id = '<user_id>' AND workspace_id = '<workspace_id>';
  ```
- [ ] If missing, add via admin panel or:
  ```sql
  INSERT INTO public.admin_access (user_id, workspace_id, role)
  VALUES ('<user_id>', '<workspace_id>', 'admin');
  ```

### ❌ Migration failed - Rollback

- [ ] Go to Supabase Dashboard → Database → Backups
- [ ] Find backup from before migration
- [ ] Click "Restore from backup"
- [ ] Wait 5-10 minutes
- [ ] Database is restored to known-good state

---

## Sign Off

- [ ] **32. Final confirmation**
  - Migration executed: ✅
  - All verifications passed: ✅
  - Functional tests passed: ✅
  - Team notified: ✅
  - Ready for production: ✅

Executed by: ________________
Date: ________________
Time: ________________

---

## Next Steps

1. Monitor Supabase logs for errors
2. Test signup/invite flows in production
3. Inform team that features are now available
4. Archive this checklist for records

**All done! 🎉**
