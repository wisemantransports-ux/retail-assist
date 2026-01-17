-- =============================================
-- 034_normalize_employees_workspace.sql
-- Normalize employees to workspace_id (RLS-safe)
-- =============================================

BEGIN;

-- 1️⃣ Drop legacy RLS policy that depends on business_id
DROP POLICY IF EXISTS employees_business_admin ON public.employees;

-- 2️⃣ Ensure workspace_id exists
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- 3️⃣ Backfill workspace_id from business_id
UPDATE public.employees
SET workspace_id = business_id
WHERE workspace_id IS NULL
  AND business_id IS NOT NULL;

-- 4️⃣ Enforce NOT NULL
ALTER TABLE public.employees
ALTER COLUMN workspace_id SET NOT NULL;

-- 5️⃣ Drop legacy column
ALTER TABLE public.employees
DROP COLUMN IF EXISTS business_id;

-- 6️⃣ Remove legacy indexes
DROP INDEX IF EXISTS employees_user_id_business_id_key;
DROP INDEX IF EXISTS idx_employees_business;

-- 7️⃣ Ensure canonical uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employee_workspace_user
ON public.employees (user_id, workspace_id);

-- 8️⃣ Recreate RLS policy using workspace_id
CREATE POLICY employees_workspace_admin
ON public.employees
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_access aa
    WHERE aa.user_id = auth.uid()
      AND aa.workspace_id = employees.workspace_id
  )
);

COMMIT;

-- =============================================
-- END OF 034
-- =============================================