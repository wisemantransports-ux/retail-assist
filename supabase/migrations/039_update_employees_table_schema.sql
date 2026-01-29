-- =============================================
-- 0039_update_employees_table_schema.sql
-- Production-safe employees schema (authoritative)
-- =============================================

BEGIN;

-- =====================================================
-- 1. ENSURE EMPLOYEES TABLE EXISTS
-- =====================================================
-- Assumes employees table already exists.
-- This migration STRICTLY normalizes it.

-- =====================================================
-- 2. ADD / FIX COLUMNS (NO DANGEROUS DEFAULTS)
-- =====================================================

-- Auth UID must be explicitly set at invite acceptance
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS auth_uid UUID;

-- Email must always be explicit and meaningful
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS email TEXT;

-- Workspace scoping (NULL = platform employee)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS workspace_id UUID
REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Who invited this employee (scope authority)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS invited_by_role TEXT
CHECK (invited_by_role IN ('super_admin', 'client_admin'));

-- Employee lifecycle status
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS status TEXT
CHECK (status IN ('pending', 'active', 'inactive'))
DEFAULT 'active';

-- =====================================================
-- 3. HARD CONSTRAINTS (AUTHORITATIVE RULES)
-- =====================================================

-- Each auth user can only be one employee
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_auth_uid
ON public.employees(auth_uid)
WHERE auth_uid IS NOT NULL;

-- Prevent duplicate employees per workspace
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_email_workspace
ON public.employees(email, workspace_id);

-- Fast lookups
CREATE INDEX IF NOT EXISTS idx_employees_email
ON public.employees(email);

CREATE INDEX IF NOT EXISTS idx_employees_workspace
ON public.employees(workspace_id);

-- =====================================================
-- 4. ENFORCE DATA INTEGRITY
-- =====================================================

-- auth_uid MUST be set once employee is active
ALTER TABLE public.employees
ADD CONSTRAINT employees_auth_uid_required_for_active
CHECK (
  status != 'active'
  OR auth_uid IS NOT NULL
);

-- =====================================================
-- 5. REMOVE LEGACY / INVALID POLICIES
-- =====================================================

DROP POLICY IF EXISTS employees_super_admin ON public.employees;
DROP POLICY IF EXISTS employees_workspace_admin ON public.employees;
DROP POLICY IF EXISTS employees_self ON public.employees;

-- =====================================================
-- 6. ROW LEVEL SECURITY (STRICT & CORRECT)
-- =====================================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- Super admin: full read access (platform-wide)
-- -----------------------------------------------------
CREATE POLICY employees_super_admin_read
ON public.employees
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role = 'super_admin'
  )
);

-- -----------------------------------------------------
-- Client admin: read employees in their workspace only
-- -----------------------------------------------------
CREATE POLICY employees_client_admin_read
ON public.employees
FOR SELECT
USING (
  workspace_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role = 'client_admin'
      AND u.workspace_id = employees.workspace_id
  )
);

-- -----------------------------------------------------
-- Employee: can read ONLY their own record
-- -----------------------------------------------------
CREATE POLICY employees_self_read
ON public.employees
FOR SELECT
USING (
  auth_uid = auth.uid()
);

-- -----------------------------------------------------
-- Inserts are NOT allowed via RLS
-- Invite acceptance MUST use service_role or RPC
-- -----------------------------------------------------
REVOKE INSERT ON public.employees FROM anon, authenticated;

COMMIT;