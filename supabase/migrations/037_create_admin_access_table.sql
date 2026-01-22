-- =============================================
-- 037_create_admin_access_table.sql
-- Create missing admin_access table
-- =============================================

-- Create admin_access table for tracking workspace admins
CREATE TABLE IF NOT EXISTS public.admin_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, workspace_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_access_user_id ON public.admin_access(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_workspace_id ON public.admin_access(workspace_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_role ON public.admin_access(role);

-- Enable RLS
ALTER TABLE public.admin_access ENABLE ROW LEVEL SECURITY;

-- Admin can read other admins in their workspace
DROP POLICY IF EXISTS "admin_access_read_workspace_admins" ON public.admin_access;
CREATE POLICY "admin_access_read_workspace_admins"
ON public.admin_access
FOR SELECT
USING (
  -- User can see admins in workspaces they have access to
  EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = auth.uid()
      AND aa.workspace_id = admin_access.workspace_id
  )
  OR
  -- Super admin can see everything
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role = 'super_admin'
  )
);

-- Admins can manage their workspace's admin list
DROP POLICY IF EXISTS "admin_access_write_workspace_admins" ON public.admin_access;
CREATE POLICY "admin_access_write_workspace_admins"
ON public.admin_access
FOR ALL
USING (
  -- Workspace admin can manage their workspace's admins
  EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = auth.uid()
      AND aa.workspace_id = admin_access.workspace_id
      AND aa.role = 'admin'
  )
  OR
  -- Super admin can manage everything
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role = 'super_admin'
  )
)
WITH CHECK (
  -- Workspace admin can manage their workspace's admins
  EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = auth.uid()
      AND aa.workspace_id = admin_access.workspace_id
      AND aa.role = 'admin'
  )
  OR
  -- Super admin can manage everything
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role = 'super_admin'
  )
);

-- =============================================
-- Migrate existing workspace owners to admin_access
-- =============================================

INSERT INTO public.admin_access (user_id, workspace_id, role)
SELECT w.owner_id, w.id, 'admin'
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_access aa
  WHERE aa.user_id = w.owner_id AND aa.workspace_id = w.id
)
ON CONFLICT (user_id, workspace_id) DO NOTHING;

-- =============================================
-- Migrate super_admin users (workspace_id = NULL)
-- =============================================

INSERT INTO public.admin_access (user_id, workspace_id, role)
SELECT u.id, NULL, 'super_admin'
FROM public.users u
WHERE u.role = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_access aa
    WHERE aa.user_id = u.id AND aa.workspace_id IS NULL
  )
ON CONFLICT (user_id, workspace_id) DO NOTHING;

-- =============================================
-- END OF 037
-- =============================================
