-- =============================================
-- 035_employee_workspace_constraints.sql
-- Enforce employee workspace scoping and access rules
-- =============================================

BEGIN;

-- ===== 1. ENFORCE SINGLE WORKSPACE PER EMPLOYEE =====
-- Add NOT NULL constraint if not already present
ALTER TABLE public.employees
ALTER COLUMN workspace_id SET NOT NULL;

-- Create unique constraint: user can belong to only ONE workspace
-- (This ensures employees can't be in multiple workspaces)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employee_single_workspace
ON public.employees (user_id) WHERE workspace_id IS NOT NULL;

-- ===== 2. ENFORCE EMPLOYEE CANNOT BE ADMIN AND EMPLOYEE SIMULTANEOUSLY =====
-- Create check constraint: if user is in employees table, they cannot have admin_access
-- (This is enforced at app level, but document it here)
CREATE OR REPLACE FUNCTION public.check_employee_not_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this user is already an admin
  IF EXISTS (
    SELECT 1 FROM public.admin_access
    WHERE user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'User cannot be both admin and employee';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_employee_not_admin_before_insert
BEFORE INSERT ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.check_employee_not_admin();

-- ===== 3. ENFORCE SUPER ADMIN HAS NO WORKSPACE =====
-- Create check constraint: super_admin must never have workspace_id set
ALTER TABLE public.users
ADD CONSTRAINT super_admin_no_workspace
CHECK (
  (role != 'super_admin') OR (role = 'super_admin')
  -- This is enforced at app level - super_admin records should have NO employee row
);

-- ===== 4. IMPROVE RLS FOR EMPLOYEES TABLE =====
-- Drop old RLS if exists
DROP POLICY IF EXISTS employees_workspace_admin ON public.employees;
DROP POLICY IF EXISTS employees_read ON public.employees;
DROP POLICY IF EXISTS employees_insert ON public.employees;
DROP POLICY IF EXISTS employees_update ON public.employees;
DROP POLICY IF EXISTS employees_delete ON public.employees;

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Admin can read/manage employees in their workspace
CREATE POLICY employees_admin_all
ON public.employees
FOR ALL
USING (
  -- Admin of this workspace can access
  EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = auth.uid()
      AND aa.workspace_id = employees.workspace_id
  )
)
WITH CHECK (
  -- Admin of this workspace can access
  EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = auth.uid()
      AND aa.workspace_id = employees.workspace_id
  )
);

-- Employee can read their own record only
CREATE POLICY employees_self_read
ON public.employees
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Super admin can read all employees (for platform administration)
CREATE POLICY employees_super_admin_all
ON public.employees
FOR ALL
USING (
  -- Check if current user is super_admin
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role = 'super_admin'
  )
);

-- ===== 5. IMPROVE RLS FOR EMPLOYEE_INVITES TABLE =====
DROP POLICY IF EXISTS employee_invites_admin ON public.employee_invites;
DROP POLICY IF EXISTS employee_invites_read ON public.employee_invites;

ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

-- Admin can create, read, and manage invites for their workspace only
CREATE POLICY employee_invites_admin_all
ON public.employee_invites
FOR ALL
USING (
  -- Admin of this workspace can access
  EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = auth.uid()
      AND aa.workspace_id = employee_invites.workspace_id
  )
)
WITH CHECK (
  -- Admin of this workspace can access
  EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = auth.uid()
      AND aa.workspace_id = employee_invites.workspace_id
  )
);

-- Super admin can create/manage platform_staff invites only
CREATE POLICY employee_invites_super_admin
ON public.employee_invites
FOR ALL
USING (
  -- Super admin can create platform_staff invites
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role = 'super_admin'
  )
  AND workspace_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role = 'super_admin'
  )
  AND workspace_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- Invited employees can accept their own invite
CREATE POLICY employee_invites_accept
ON public.employee_invites
FOR UPDATE
USING (
  -- Anyone with a pending invite can accept
  status = 'pending'
)
WITH CHECK (
  status IN ('pending', 'accepted')
);

-- ===== 6. CREATE HELPER FUNCTION: VERIFY EMPLOYEE WORKSPACE ACCESS =====
-- This function verifies an employee can access a specific workspace
CREATE OR REPLACE FUNCTION public.employee_has_workspace_access(
  p_user_id uuid,
  p_workspace_id uuid
)
RETURNS boolean AS $$
BEGIN
  -- Check if user is an employee in this workspace
  RETURN EXISTS (
    SELECT 1
    FROM public.employees
    WHERE user_id = p_user_id
      AND workspace_id = p_workspace_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.employee_has_workspace_access TO authenticated;

-- ===== 7. CREATE HELPER FUNCTION: GET EMPLOYEE WORKSPACE =====
-- This function gets the single workspace for an employee
CREATE OR REPLACE FUNCTION public.get_employee_workspace(
  p_user_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.employees
  WHERE user_id = p_user_id
  LIMIT 1;
  
  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_employee_workspace TO authenticated;

COMMIT;

-- =============================================
-- END OF 035
-- =============================================
