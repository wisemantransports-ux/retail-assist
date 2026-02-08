-- =============================================
-- 031_insert_super_admin.sql (fixed)
-- Insert system super_admin if not exists
-- =============================================

BEGIN;

-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.admin_access (
  user_id UUID NOT NULL REFERENCES public.users(id),
  workspace_id UUID,
  role TEXT NOT NULL,
  PRIMARY KEY(user_id, workspace_id)
);

-- Insert system super admin
INSERT INTO public.admin_access(user_id, workspace_id, role)
SELECT u.id, NULL::UUID, 'super_admin'
FROM public.users u
WHERE u.email = 'system@retail-assist.local'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_access aa WHERE aa.user_id = u.id
  );

COMMIT;