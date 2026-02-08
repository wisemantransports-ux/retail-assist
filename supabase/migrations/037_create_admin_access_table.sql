-- =============================================
-- 037_create_admin_access_table.sql
-- Ensure admin_access table exists
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_access (
  user_id UUID NOT NULL REFERENCES public.users(id),
  workspace_id UUID,
  role TEXT NOT NULL,
  PRIMARY KEY(user_id, workspace_id)
);

-- Policy: read workspace admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'admin_access_read_workspace_admins'
  ) THEN
    EXECUTE '
      CREATE POLICY admin_access_read_workspace_admins
      ON public.admin_access
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.admin_access aa
          WHERE aa.user_id = auth.uid()
            AND aa.workspace_id = admin_access.workspace_id
        )
        OR EXISTS (
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