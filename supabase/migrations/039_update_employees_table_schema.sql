-- =============================================
-- 039_update_employees_table_schema.sql
-- RLS policies for employees table
-- =============================================

BEGIN;

-- Ensure workspace_id column exists
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Super admin: full read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'employees_super_admin_read'
  ) THEN
    EXECUTE '
      CREATE POLICY employees_super_admin_read
      ON public.employees
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid()
            AND wm.role = ''super_admin''
        )
      )
    ';
  END IF;
END;
$$;

COMMIT;