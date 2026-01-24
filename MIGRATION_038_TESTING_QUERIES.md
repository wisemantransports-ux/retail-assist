# Migration 038 - Copy-Paste Testing Queries

All queries ready to run in Supabase SQL Editor after migration.

---

## 🔍 VERIFICATION SECTION 1: Table Schema

### Check Users Table Has All Columns

```sql
-- Verify users table has all required columns
SELECT 
  'id' AS column_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id') THEN 'EXISTS' ELSE 'MISSING' END AS status
UNION ALL SELECT 'auth_uid', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='auth_uid') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'email', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'role', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'plan_type', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='plan_type') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'phone', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'business_name', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='business_name') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'payment_status', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='payment_status') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'subscription_status', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_status') THEN 'EXISTS' ELSE 'MISSING' END
ORDER BY column_name;
```

### Check Employees Table Uses workspace_id

```sql
-- Verify employees uses workspace_id (not business_id)
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='workspace_id') 
    THEN 'workspace_id EXISTS (CORRECT)' 
    ELSE 'workspace_id MISSING (ERROR)' 
  END AS workspace_id_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='business_id') 
    THEN 'business_id EXISTS (OLD - should be removed)' 
    ELSE 'business_id removed (CORRECT)' 
  END AS business_id_status;
```

### Check Employee_Invites Has full_name

```sql
-- Verify employee_invites has full_name
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employee_invites' AND column_name='full_name') 
    THEN 'full_name EXISTS (CORRECT)' 
    ELSE 'full_name MISSING (ERROR)' 
  END AS status;
```

### Check Sessions FK References public.users

```sql
-- Verify sessions FK references public.users (not auth.users)
SELECT 
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.referential_constraints 
WHERE table_name = 'sessions' AND column_name = 'user_id';
```

---

## 🎯 VERIFICATION SECTION 2: Functions & Triggers

### Check RPC Functions Exist

```sql
-- Verify RPC functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN ('rpc_create_user_profile', 'rpc_get_user_access', 'rpc_create_employee_invite')
AND routine_schema = 'public'
ORDER BY routine_name;
```

### Check Auth Trigger Exists

```sql
-- Verify auth trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
AND trigger_schema = 'public';
```

### Check RLS Policies

```sql
-- List all RLS policies on key tables
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  qual AS using_clause
FROM pg_policies
WHERE tablename IN ('users', 'admin_access', 'employee_invites', 'employees', 'workspaces', 'workspace_members')
ORDER BY tablename, policyname;
```

---

## 📊 VERIFICATION SECTION 3: Data State

### Check Admin Access Records

```sql
-- See what admin_access records exist
SELECT 
  COUNT(*) as total_count,
  role,
  CASE WHEN workspace_id IS NULL THEN 'Platform' ELSE 'Workspace' END as access_type
FROM public.admin_access
GROUP BY role, (workspace_id IS NULL)
ORDER BY role, access_type;
```

### Check Existing Users

```sql
-- See all users and their roles
SELECT 
  id,
  email,
  role,
  plan_type,
  phone,
  business_name,
  created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 10;
```

### Check Workspaces

```sql
-- See all workspaces and their owners
SELECT 
  w.id,
  w.name,
  u.email as owner_email,
  u.role as owner_role,
  w.created_at
FROM public.workspaces w
JOIN public.users u ON w.owner_id = u.id
ORDER BY w.created_at DESC
LIMIT 10;
```

### Check Employee Invites Pending

```sql
-- See pending invites
SELECT 
  id,
  email,
  token,
  status,
  created_at,
  expires_at,
  created_at + interval '30 days' as computed_expiry
FROM public.employee_invites
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🧪 TEST SECTION 1: Signup Flow

### Test 1a: Check Pre-Signup State

```sql
-- Before signup - check user doesn't exist
SELECT * FROM public.users WHERE email = 'testuser_migrate@example.com';
```

### Test 1b: After Signup - Verify User Created

```sql
-- After signup, run these to verify everything created:
-- 1. Check auth user exists
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'testuser_migrate@example.com';

-- 2. Check public user created (via trigger)
SELECT id, auth_uid, email, role, plan_type, phone, business_name FROM public.users WHERE email = 'testuser_migrate@example.com';

-- 3. Check workspace created
SELECT w.id, w.name, w.owner_id, u.email as owner_email FROM public.workspaces w
JOIN public.users u ON w.owner_id = u.id
WHERE u.email = 'testuser_migrate@example.com';

-- 4. Check admin_access created
SELECT user_id, workspace_id, role FROM public.admin_access
WHERE user_id = (SELECT id FROM public.users WHERE email = 'testuser_migrate@example.com');

-- 5. Check workspace_members created
SELECT user_id, workspace_id, role FROM public.workspace_members
WHERE user_id = (SELECT id FROM public.users WHERE email = 'testuser_migrate@example.com');
```

---

## 📧 TEST SECTION 2: Invite Flow

### Test 2a: Create Invite (as Admin)

```sql
-- First, get an admin user ID and their workspace
WITH admin_user AS (
  SELECT 
    u.id,
    u.email,
    w.id as workspace_id
  FROM public.users u
  JOIN public.workspaces w ON w.owner_id = u.id
  LIMIT 1
)
-- Now you have the IDs to use in the RPC call
SELECT * FROM admin_user;

-- Then run RPC to create invite (substitute with actual IDs)
-- Note: This requires the user to be authenticated as the admin
-- SELECT * FROM rpc_create_employee_invite(
--   p_workspace_id := '00000000-0000-0000-0000-000000000001',
--   p_email := 'newemp@example.com',
--   p_invited_by := '00000000-0000-0000-0000-000000000002',
--   p_role := 'employee'
-- );
```

### Test 2b: Verify Invite Created

```sql
-- After invite created, check it exists
SELECT 
  id,
  token,
  email,
  status,
  created_at,
  expires_at,
  CASE WHEN expires_at > NOW() THEN 'Valid' ELSE 'Expired' END as validity
FROM public.employee_invites
WHERE email = 'newemp@example.com'
ORDER BY created_at DESC
LIMIT 1;
```

### Test 2c: After Accepting Invite

```sql
-- After employee accepts invite, verify everything:

-- 1. New employee user should exist
SELECT id, email, role FROM public.users WHERE email = 'newemp@example.com';

-- 2. Employee record should exist
SELECT 
  id,
  user_id,
  workspace_id,
  full_name,
  is_active
FROM public.employees
WHERE user_id = (SELECT id FROM public.users WHERE email = 'newemp@example.com');

-- 3. Invite status should be accepted
SELECT 
  id,
  token,
  status,
  accepted_at,
  full_name
FROM public.employee_invites
WHERE email = 'newemp@example.com'
ORDER BY created_at DESC
LIMIT 1;
```

---

## 👥 TEST SECTION 3: Multi-Account Support

### Test 3a: Create Multiple Users

```sql
-- Create test users (these need to be done via signup endpoint)
-- But you can verify they exist with:
SELECT 
  id,
  email,
  role,
  created_at
FROM public.users
WHERE email LIKE 'testuser%'
ORDER BY created_at;
```

### Test 3b: Verify Workspace Isolation

```sql
-- Verify each user has their own workspace
WITH user_workspaces AS (
  SELECT 
    u.email,
    w.id as workspace_id,
    COUNT(u.id) OVER (PARTITION BY w.owner_id) as workspaces_owned
  FROM public.users u
  JOIN public.workspaces w ON w.owner_id = u.id
)
SELECT 
  email,
  COUNT(*) as workspace_count,
  STRING_AGG(workspace_id::text, ', ') as workspace_ids
FROM user_workspaces
WHERE email LIKE 'testuser%'
GROUP BY email;
```

### Test 3c: Verify No Cross-Workspace Data Leakage

```sql
-- Verify employees are isolated to their workspace
SELECT 
  u.email as employee_email,
  e.workspace_id,
  w.name as workspace_name,
  wu.email as workspace_owner_email
FROM public.employees e
JOIN public.users u ON e.user_id = u.id
JOIN public.workspaces w ON e.workspace_id = w.id
JOIN public.users wu ON w.owner_id = wu.id
WHERE u.email LIKE 'newemp%'
ORDER BY u.email;
```

---

## 🔐 TEST SECTION 4: RLS Enforcement

### Test 4a: RLS on Users Table

```sql
-- Check users can only see their own record
-- (Run this as the test user via API to verify RLS works)
-- Expected: Only returns the authenticated user's row
SELECT id, email, role FROM public.users;
```

### Test 4b: RLS on Admin_Access Table

```sql
-- Check admin can see admins in their workspace
-- Expected: User sees their own admin_access records only
SELECT user_id, workspace_id, role FROM public.admin_access;
```

### Test 4c: RLS on Employees Table

```sql
-- Check employees table RLS
-- Expected: Employee sees only their own record
-- Admin sees employees in their workspace(s)
SELECT id, user_id, workspace_id, full_name FROM public.employees;
```

---

## 🐛 TROUBLESHOOTING SECTION

### Debug: User Not Created After Signup

```sql
-- Check if auth user exists
SELECT id, email FROM auth.users WHERE email = 'problem@example.com';

-- Check if public user created
SELECT id, auth_uid, email FROM public.users WHERE email = 'problem@example.com';

-- If auth user exists but public.users doesn't, manually create:
-- INSERT INTO public.users (auth_uid, email)
-- VALUES ('<auth-uid>', 'problem@example.com');

-- Or check if trigger executed:
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'on_auth_user_created';
```

### Debug: Invite Token Not Found

```sql
-- Check if token exists in database
SELECT token, status, email FROM public.employee_invites WHERE token LIKE '%token-start%';

-- Check token length (should be 32 chars = 16 bytes hex encoded)
SELECT 
  token,
  LENGTH(token) as token_length,
  email,
  status
FROM public.employee_invites
ORDER BY created_at DESC
LIMIT 5;

-- Check for expired invites
SELECT 
  token,
  email,
  expires_at,
  NOW() as current_time,
  CASE WHEN expires_at < NOW() THEN 'EXPIRED' ELSE 'VALID' END as status
FROM public.employee_invites
WHERE status = 'pending'
ORDER BY expires_at;
```

### Debug: Inviter Not Admin

```sql
-- Check if user has admin access
SELECT 
  aa.user_id,
  aa.workspace_id,
  aa.role,
  u.email
FROM public.admin_access aa
JOIN public.users u ON aa.user_id = u.id
WHERE u.email = 'inviter@example.com';

-- If missing, manually add (if appropriate):
-- INSERT INTO public.admin_access (user_id, workspace_id, role)
-- VALUES ('<user-id>', '<workspace-id>', 'admin');
```

### Debug: RLS Policy Issues

```sql
-- List all policies
SELECT 
  tablename,
  policyname,
  cmd as operation,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check if RLS enabled on table
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'admin_access', 'employees', 'employee_invites')
ORDER BY tablename;
```

---

## 📈 ANALYTICS SECTION

### Count Users by Role

```sql
SELECT 
  role,
  COUNT(*) as count,
  STRING_AGG(email, ', ') as emails
FROM public.users
GROUP BY role
ORDER BY count DESC;
```

### Count Workspaces per User

```sql
SELECT 
  u.email,
  COUNT(w.id) as workspace_count
FROM public.users u
LEFT JOIN public.workspaces w ON w.owner_id = u.id
WHERE u.email LIKE 'testuser%'
GROUP BY u.email, u.id
ORDER BY workspace_count DESC;
```

### Count Employees per Workspace

```sql
SELECT 
  w.name as workspace_name,
  u.email as owner_email,
  COUNT(e.id) as employee_count
FROM public.workspaces w
LEFT JOIN public.users u ON w.owner_id = u.id
LEFT JOIN public.employees e ON e.workspace_id = w.id
GROUP BY w.id, w.name, u.email
ORDER BY employee_count DESC;
```

### Invite Statistics

```sql
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_count
FROM public.employee_invites
GROUP BY status
ORDER BY status;
```

---

## 🔄 DATA MAINTENANCE SECTION

### Cleanup Expired Invites (Optional)

```sql
-- View expired invites (non-destructive)
SELECT 
  id,
  email,
  token,
  expires_at,
  created_at
FROM public.employee_invites
WHERE status = 'pending' AND expires_at < NOW();

-- Archive expired invites (optional - change status if you want to track)
-- UPDATE public.employee_invites
-- SET status = 'expired'
-- WHERE status = 'pending' AND expires_at < NOW();
```

### List Users Without Workspaces (Super Admins)

```sql
-- Find users with no workspace (likely super_admin)
SELECT 
  u.id,
  u.email,
  u.role,
  COUNT(w.id) as workspace_count
FROM public.users u
LEFT JOIN public.workspaces w ON w.owner_id = u.id
GROUP BY u.id, u.email, u.role
HAVING COUNT(w.id) = 0
ORDER BY u.created_at DESC;
```

---

## ✅ FINAL VERIFICATION CHECKLIST

Run these in order to get a complete health check:

```sql
-- 1. Check schema
SELECT COUNT(*) as tables_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Check columns
SELECT COUNT(*) as total_columns FROM information_schema.columns 
WHERE table_schema = 'public';

-- 3. Check RLS enabled
SELECT COUNT(*) as rls_tables FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- 4. Check policies
SELECT COUNT(*) as total_policies FROM pg_policies 
WHERE schemaname = 'public';

-- 5. Check data
SELECT 
  (SELECT COUNT(*) FROM public.users) as user_count,
  (SELECT COUNT(*) FROM public.workspaces) as workspace_count,
  (SELECT COUNT(*) FROM public.employees) as employee_count,
  (SELECT COUNT(*) FROM public.admin_access) as admin_access_count,
  (SELECT COUNT(*) FROM public.employee_invites) as invite_count;

-- Expected: All should have reasonable numbers or 0 if empty (which is fine for new migration)
```

---

**Ready to test!** Copy and paste any query above into your Supabase SQL Editor.

*Last Updated: January 22, 2026*
