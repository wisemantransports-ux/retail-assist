-- =============================================
-- 029_fix_get_user_access.sql
-- Correct, schema-safe role resolution
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
    r.user_id,
    r.workspace_id,
    r.role
  from (
    -- 1️⃣ Super Admin (platform-level, users table ONLY)
    select
      u.id as user_id,
      null::uuid as workspace_id,
      'super_admin'::text as role,
      1 as priority
    from public.users u
    where u.auth_uid = auth.uid()
      and u.role = 'super_admin'

    union all

    -- 2️⃣ Client Admin (workspace-level, admin_access with workspace)
    select
      aa.user_id,
      aa.workspace_id,
      'admin'::text as role,
      2 as priority
    from public.admin_access aa
    join public.users u on u.id = aa.user_id
    where u.auth_uid = auth.uid()
      and aa.workspace_id is not null

    union all

    -- 3️⃣ Employee (only if not admin and not super_admin)
    select
      e.user_id,
      e.business_id as workspace_id,
      'employee'::text as role,
      3 as priority
    from public.employees e
    join public.users u on u.id = e.user_id
    where u.auth_uid = auth.uid()
      and not exists (
        select 1
        from public.admin_access aa2
        where aa2.user_id = e.user_id
      )
      and not exists (
        select 1
        from public.users u3
        where u3.auth_uid = auth.uid()
          and u3.role = 'super_admin'
      )
  ) r
  order by r.priority
  limit 1;
$$;

revoke all on function public.rpc_get_user_access from public;
grant execute on function public.rpc_get_user_access to authenticated;

-- =============================================
-- END OF 029
-- =============================================