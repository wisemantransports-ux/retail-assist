-- 024_create_rpc_create_user_profile.sql

create or replace function public.rpc_create_user_profile(
  p_auth_uid uuid,
  p_business_name text,
  p_email text,
  p_full_name text,
  p_phone text,
  p_plan_type text
)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_workspace_id uuid;
begin
  -- Resolve internal user created by the auth trigger. Do NOT insert into public.users.
  select id into v_user_id
  from public.users
  where auth_uid = p_auth_uid;

  if v_user_id is null then
    raise exception 'internal user not found for auth_uid %', p_auth_uid;
  end if;

  -- Reuse existing workspace if present, otherwise create one.
  select id into v_workspace_id from public.workspaces where owner_id = v_user_id;

  if v_workspace_id is null then
    insert into public.workspaces (name, owner_id)
    values (p_business_name, v_user_id)
    returning id into v_workspace_id;
  end if;

  -- Ensure workspace_members exists (no duplicate)
  insert into public.workspace_members (workspace_id, user_id, role)
  select v_workspace_id, v_user_id, 'member'
  where not exists (
    select 1 from public.workspace_members where workspace_id = v_workspace_id and user_id = v_user_id
  );

  -- Ensure admin_access exists (no duplicate)
  insert into public.admin_access (workspace_id, user_id, role)
  select v_workspace_id, v_user_id, 'admin'
  where not exists (
    select 1 from public.admin_access where workspace_id = v_workspace_id and user_id = v_user_id
  );
end;
$$;

-- Lock down permissions
revoke all on function public.rpc_create_user_profile from public;
grant execute on function public.rpc_create_user_profile to anon;
grant execute on function public.rpc_create_user_profile to authenticated;