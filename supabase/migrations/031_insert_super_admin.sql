-- =============================================
-- Insert super admin into admin_access
-- =============================================

INSERT INTO public.admin_access(user_id, workspace_id, role)
VALUES (
  '0d5ff8c7-31ac-4d5f-8c4c-556d8bd08ab7', -- super admin user_id
  NULL, -- null workspace_id for platform-level access
  'super_admin'
)
ON CONFLICT (user_id, workspace_id) DO NOTHING;