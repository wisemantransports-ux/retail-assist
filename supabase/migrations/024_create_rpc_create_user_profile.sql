-- =============================================
-- 024_rpc_create_user_profile_fixed.sql
-- Safely drop and create user profile function
-- =============================================

-- Drop existing function specifying all argument types
DROP FUNCTION IF EXISTS public.rpc_create_user_profile(
  uuid, text, text, text, text, text, boolean
);

-- Create or replace the function
CREATE OR REPLACE FUNCTION public.rpc_create_user_profile(
  p_auth_uid uuid,
  p_business_name text,
  p_email text,
  p_full_name text,
  p_phone text,
  p_plan_type text,
  p_is_super_admin boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_workspace_id uuid;
BEGIN
  -- Resolve internal user created by the auth trigger
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_uid = p_auth_uid;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'internal user not found for auth_uid %', p_auth_uid;
  END IF;

  -- Reuse existing workspace if present, otherwise create one
  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE owner_id = v_user_id;

  IF v_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (p_business_name, v_user_id)
    RETURNING id INTO v_workspace_id;
  END IF;

  -- Ensure workspace_members exists (no duplicate)
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT v_workspace_id, v_user_id, 'member'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_workspace_id AND user_id = v_user_id
  );

  -- Ensure admin_access exists (no duplicate)
  INSERT INTO public.admin_access (workspace_id, user_id, role)
  SELECT v_workspace_id, v_user_id,
         CASE WHEN p_is_super_admin THEN 'super_admin' ELSE 'admin' END
  WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_access
    WHERE workspace_id = v_workspace_id AND user_id = v_user_id
  );
END;
$$;

-- Lock down permissions
REVOKE ALL ON FUNCTION public.rpc_create_user_profile(uuid, text, text, text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_create_user_profile(uuid, text, text, text, text, text, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_user_profile(uuid, text, text, text, text, text, boolean) TO authenticated;

-- =============================================
-- END OF 024
-- =============================================