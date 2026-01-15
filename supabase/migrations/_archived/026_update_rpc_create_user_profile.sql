“Not applied. Auth verified stable. Superseded.”
-- 026_update_rpc_create_user_profile.sql
-- Update the RPC to return user data and update business_name, phone, full_name.

create or replace function public.rpc_create_user_profile(
  p_auth_uid uuid,
  p_business_name text,
  p_email text,
  p_full_name text,
  p_phone text,
  p_plan_type text
)
returns table (
  id uuid,
  auth_uid uuid,
  email text,
  business_name text,
  phone text,
  full_name text,
  plan_type text,
  role text,
  payment_status text,
  subscription_status text
)
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_workspace_id uuid;
begin
  -- Resolve internal user created by the auth trigger.
  select id into v_user_id
  from public.users
  where auth_uid = p_auth_uid;

  if v_user_id is null then
    raise exception 'internal user not found for auth_uid %', p_auth_uid;
  end if;

  -- Update the user profile with provided data
  update public.users
  set 
    business_name = coalesce(p_business_name, business_name),
    email = coalesce(p_email, email),
    phone = coalesce(p_phone, phone),
    full_name = coalesce(p_full_name, full_name),
    plan_type = coalesce(p_plan_type, plan_type),
    updated_at = now()
  where id = v_user_id;

  -- Reuse existing workspace if present, otherwise create one.
  select id into v_workspace_id from public.workspaces where owner_id = v_user_id;

  if v_workspace_id is null then
    insert into public.workspaces (name, owner_id)
    values (coalesce(p_business_name, 'My Workspace'), v_user_id)
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

  -- Return the updated user
  return query
  select 
    u.id,
    u.auth_uid,
    u.email,
    u.business_name,
    u.phone,
    u.full_name,
    u.plan_type,
    u.role,
    u.payment_status,
    u.subscription_status
  from public.users u
  where u.id = v_user_id;
end;
$$;

-- Lock down permissions
revoke all on function public.rpc_create_user_profile from public;
grant execute on function public.rpc_create_user_profile to anon;
grant execute on function public.rpc_create_user_profile to authenticated;
