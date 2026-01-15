-- =============================================
-- 028_get_user_access.sql
-- Returns platform / workspace admin access
-- =============================================

create or replace function public.rpc_get_user_access()
returns table (
  user_id uuid,
  workspace_id uuid,
  role text
)
language sql
security definer
as $$
  select
    aa.user_id,
    aa.workspace_id,
    aa.role
  from public.admin_access aa
  where aa.user_id = auth.uid();
$$;

-- Lock down permissions
revoke all on function public.rpc_get_user_access from public;
grant execute on function public.rpc_get_user_access to authenticated;

-- =============================================
-- END OF 028
-- =============================================