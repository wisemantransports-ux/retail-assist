-- =============================================
-- 030_employees_dashboard.sql (fixed for workspace_members)
-- Aligns employees table access with workspace_members roles
-- =============================================

BEGIN;

-- Ensure table exists first
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  workspace_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Super Admin: can access all employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'employees_super_admin'
  ) THEN
    EXECUTE '
      CREATE POLICY employees_super_admin
      ON public.employees
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid()
            AND wm.role = ''super_admin''
        )
      )
    ';
  END IF;
END;
$$;

-- Workspace Admin: can access employees in their workspace
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'employees_workspace_admin'
  ) THEN
    EXECUTE '
      CREATE POLICY employees_workspace_admin
      ON public.employees
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid()
            AND wm.workspace_id = employees.workspace_id
            AND wm.role = ''admin''
        )
      )
    ';
  END IF;
END;
$$;

-- Employee: can access own record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'employees_self'
  ) THEN
    EXECUTE '
      CREATE POLICY employees_self
      ON public.employees
      FOR ALL
      USING (user_id = auth.uid())
    ';
  END IF;
END;
$$;

COMMIT;