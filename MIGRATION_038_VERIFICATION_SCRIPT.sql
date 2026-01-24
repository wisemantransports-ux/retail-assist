-- =============================================
-- VERIFICATION SCRIPT FOR MIGRATION 038
-- Run after deploying the migration
-- All queries should return 0 errors or expected rows
-- =============================================

-- =============================================
-- PHASE 1: SCHEMA VERIFICATION
-- =============================================

-- 1.1: Verify users.role exists and has correct type
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ users.role EXISTS'
    ELSE '❌ users.role MISSING'
  END as result
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'role'
  AND data_type = 'text';

-- 1.2: Verify employees.full_name exists
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ employees.full_name EXISTS'
    ELSE '❌ employees.full_name MISSING'
  END as result
FROM information_schema.columns
WHERE table_name = 'employees' 
  AND column_name = 'full_name'
  AND data_type = 'text';

-- 1.3: Verify employees.phone exists
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ employees.phone EXISTS'
    ELSE '❌ employees.phone MISSING'
  END as result
FROM information_schema.columns
WHERE table_name = 'employees' 
  AND column_name = 'phone'
  AND data_type = 'text';

-- 1.4: Verify employees.workspace_id is NOT NULL
SELECT 
  CASE 
    WHEN is_nullable = 'NO' THEN '✅ employees.workspace_id NOT NULL'
    ELSE '❌ employees.workspace_id IS NULLABLE'
  END as result
FROM information_schema.columns
WHERE table_name = 'employees' 
  AND column_name = 'workspace_id';

-- 1.5: Verify employee_invites.expires_at exists
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ employee_invites.expires_at EXISTS'
    ELSE '❌ employee_invites.expires_at MISSING'
  END as result
FROM information_schema.columns
WHERE table_name = 'employee_invites' 
  AND column_name = 'expires_at';

-- 1.6: Verify employee_invites.full_name exists
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ employee_invites.full_name EXISTS'
    ELSE '❌ employee_invites.full_name MISSING'
  END as result
FROM information_schema.columns
WHERE table_name = 'employee_invites' 
  AND column_name = 'full_name';

-- 1.7: Verify admin_access table exists
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ admin_access table EXISTS'
    ELSE '❌ admin_access table MISSING'
  END as result
FROM information_schema.tables
WHERE table_name = 'admin_access' 
  AND table_schema = 'public';

-- =============================================
-- PHASE 2: CONSTRAINT VERIFICATION
-- =============================================

-- 2.1: Verify unique constraint on employees (single workspace)
SELECT 
  CASE 
    WHEN COUNT(*) >= 1 THEN '✅ Unique constraint on employees EXISTS'
    ELSE '❌ Unique constraint on employees MISSING'
  END as result
FROM information_schema.table_constraints
WHERE table_name = 'employees' 
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%employee%single%workspace%';

-- 2.2: Verify admin_access unique constraint
SELECT 
  CASE 
    WHEN COUNT(*) >= 1 THEN '✅ admin_access unique constraint EXISTS'
    ELSE '❌ admin_access unique constraint MISSING'
  END as result
FROM information_schema.table_constraints
WHERE table_name = 'admin_access' 
  AND constraint_type = 'UNIQUE'
  AND (constraint_name LIKE '%user_id%workspace%' 
       OR constraint_name LIKE '%admin_access%unique%');

-- 2.3: Verify employee_invites token unique constraint
SELECT 
  CASE 
    WHEN COUNT(*) >= 1 THEN '✅ employee_invites.token unique constraint EXISTS'
    ELSE '❌ employee_invites.token unique constraint MISSING'
  END as result
FROM information_schema.table_constraints
WHERE table_name = 'employee_invites' 
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%token%';

-- =============================================
-- PHASE 3: RLS VERIFICATION
-- =============================================

-- 3.1: Verify RLS is enabled on employees
SELECT 
  CASE 
    WHEN (SELECT count FROM (
      SELECT count(*) FROM pg_tables 
      WHERE tablename = 'employees' AND schemaname = 'public' 
        AND rowsecurity = true
    ) t) = 1 THEN '✅ RLS ENABLED on employees'
    ELSE '❌ RLS DISABLED on employees'
  END as result;

-- 3.2: Verify RLS is enabled on admin_access
SELECT 
  CASE 
    WHEN (SELECT count FROM (
      SELECT count(*) FROM pg_tables 
      WHERE tablename = 'admin_access' AND schemaname = 'public' 
        AND rowsecurity = true
    ) t) = 1 THEN '✅ RLS ENABLED on admin_access'
    ELSE '❌ RLS DISABLED on admin_access'
  END as result;

-- 3.3: Verify RLS is enabled on employee_invites
SELECT 
  CASE 
    WHEN (SELECT count FROM (
      SELECT count(*) FROM pg_tables 
      WHERE tablename = 'employee_invites' AND schemaname = 'public' 
        AND rowsecurity = true
    ) t) = 1 THEN '✅ RLS ENABLED on employee_invites'
    ELSE '❌ RLS DISABLED on employee_invites'
  END as result;

-- 3.4: Count RLS policies on employees
SELECT 
  'employees has ' || count(*) || ' policies' as result
FROM pg_policies
WHERE tablename = 'employees';

-- 3.5: Count RLS policies on admin_access
SELECT 
  'admin_access has ' || count(*) || ' policies' as result
FROM pg_policies
WHERE tablename = 'admin_access';

-- 3.6: Count RLS policies on employee_invites
SELECT 
  'employee_invites has ' || count(*) || ' policies' as result
FROM pg_policies
WHERE tablename = 'employee_invites';

-- =============================================
-- PHASE 4: INDEXES VERIFICATION
-- =============================================

-- 4.1: Verify indexes exist for performance
SELECT 
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅ Performance indexes created (5+)'
    WHEN COUNT(*) >= 3 THEN '⚠️ Some performance indexes missing (have ' || COUNT(*) || ')'
    ELSE '❌ Performance indexes MISSING'
  END as result
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename = 'employees' OR tablename = 'employee_invites' OR tablename = 'users')
  AND indexname LIKE 'idx_%';

-- =============================================
-- PHASE 5: DATA INTEGRITY CHECKS
-- =============================================

-- 5.1: Check for employees who are also admins (SHOULD BE 0)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No dual role violations (employees who are also admins)'
    ELSE '⚠️ Found ' || COUNT(*) || ' employees who are also admins - INTEGRITY ISSUE'
  END as result
FROM public.employees e
WHERE EXISTS (
  SELECT 1 FROM public.admin_access aa WHERE aa.user_id = e.user_id
);

-- 5.2: Check for multi-workspace employees (SHOULD BE 0)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No employees in multiple workspaces'
    ELSE '⚠️ Found ' || COUNT(*) || ' employees in multiple workspaces - INTEGRITY ISSUE'
  END as result
FROM (
  SELECT user_id, COUNT(*) as workspace_count
  FROM public.employees
  GROUP BY user_id
  HAVING COUNT(*) > 1
) multi_workspace;

-- 5.3: Check for NULL workspace_id in employees (SHOULD BE 0)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No employees with NULL workspace_id'
    ELSE '⚠️ Found ' || COUNT(*) || ' employees with NULL workspace_id - CONSTRAINT VIOLATED'
  END as result
FROM public.employees
WHERE workspace_id IS NULL;

-- 5.4: Verify platform workspace exists
SELECT 
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ Platform workspace (00000000-0000-0000-0000-000000000001) EXISTS'
    ELSE '⚠️ Platform workspace MISSING or DUPLICATE'
  END as result
FROM public.workspaces
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 5.5: Verify workspace owners in admin_access
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All workspace owners in admin_access'
    ELSE '⚠️ Found ' || COUNT(*) || ' workspace owners NOT in admin_access - DATA CONSISTENCY ISSUE'
  END as result
FROM public.workspaces w
WHERE w.id != '00000000-0000-0000-0000-000000000001'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = w.owner_id AND aa.workspace_id = w.id
  );

-- 5.6: Verify RPC functions exist
SELECT 
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ All RPC functions exist'
    ELSE '⚠️ Missing RPC functions (found ' || COUNT(*) || ')'
  END as result
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'rpc_get_user_access',
    'rpc_create_employee_invite',
    'rpc_accept_employee_invite'
  );

-- =============================================
-- PHASE 6: SAMPLE DATA QUERIES
-- =============================================

-- 6.1: Show all super admins
SELECT 
  'Super Admins:' as title,
  u.email,
  u.role,
  (SELECT COUNT(*) FROM public.admin_access aa WHERE aa.user_id = u.id AND aa.workspace_id IS NULL) as in_admin_access
FROM public.users u
WHERE u.role = 'super_admin'
LIMIT 5;

-- 6.2: Show workspace admins
SELECT 
  'Workspace Admins:' as title,
  u.email,
  w.name as workspace,
  aa.role
FROM public.admin_access aa
JOIN public.users u ON u.id = aa.user_id
LEFT JOIN public.workspaces w ON w.id = aa.workspace_id
WHERE aa.role = 'admin'
  AND aa.workspace_id IS NOT NULL
LIMIT 5;

-- 6.3: Show employees by workspace
SELECT 
  'Employees by Workspace:' as title,
  w.name,
  u.email,
  e.full_name,
  COUNT(*) OVER (PARTITION BY e.workspace_id) as employee_count_in_workspace
FROM public.employees e
JOIN public.users u ON u.id = e.user_id
JOIN public.workspaces w ON w.id = e.workspace_id
LIMIT 5;

-- 6.4: Show pending invites
SELECT 
  'Pending Invites:' as title,
  ei.email,
  w.name as workspace,
  ei.created_at,
  ei.expires_at,
  CASE WHEN ei.expires_at < NOW() THEN 'EXPIRED' ELSE 'VALID' END as status
FROM public.employee_invites ei
JOIN public.workspaces w ON w.id = ei.workspace_id
WHERE ei.status = 'pending'
LIMIT 5;

-- =============================================
-- PHASE 7: TEST QUERIES FOR API PATHS
-- =============================================

-- 7.1: Test query for /api/employees GET (admin lists employees)
-- This simulates what happens when an admin views the employees list
SELECT 
  'Query for /api/employees GET:' as title,
  e.id,
  u.email,
  e.workspace_id,
  e.full_name
FROM public.employees e
JOIN public.users u ON u.id = e.user_id
WHERE e.workspace_id = (
  SELECT aa.workspace_id 
  FROM public.admin_access aa
  WHERE aa.role = 'admin'
  LIMIT 1
)
LIMIT 3;

-- 7.2: Test query for /api/employees POST (check admin role via RPC equivalent)
-- This simulates what rpc_get_user_access() does
SELECT 
  'Query for /api/employees POST (role check):' as title,
  u.id,
  u.email,
  u.role,
  aa.workspace_id,
  aa.role as admin_role
FROM public.users u
LEFT JOIN public.admin_access aa ON aa.user_id = u.id
WHERE u.role = 'super_admin' OR aa.role = 'admin'
LIMIT 3;

-- 7.3: Test query for /api/employees/accept-invite POST (invite lookup)
-- This simulates finding an invite by token
SELECT 
  'Query for /api/employees/accept-invite POST:' as title,
  ei.id,
  ei.email,
  ei.workspace_id,
  ei.status,
  ei.invited_by,
  u.email as inviter_email
FROM public.employee_invites ei
LEFT JOIN public.users u ON u.id = ei.invited_by
WHERE ei.status = 'pending'
LIMIT 1;

-- =============================================
-- SUMMARY SECTION
-- =============================================

SELECT 'VERIFICATION COMPLETE - Review results above' as note;

-- =============================================
-- END OF VERIFICATION SCRIPT
-- =============================================
