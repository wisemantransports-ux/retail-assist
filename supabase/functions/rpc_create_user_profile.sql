
-- RPC: rpc_create_user_profile
-- Inserts a row into public.users with safe defaults and returns the created row.
-- SECURITY DEFINER allows the function to run with the function owner's privileges so the service-role can bypass RLS.
CREATE OR REPLACE FUNCTION public.rpc_create_user_profile(
    p_auth_uid uuid,
    p_business_name text,
    p_email text,
    p_full_name text default null,
    p_phone text,
    p_plan_type text default 'starter'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
    v_user_id uuid;
    v_workspace_id uuid;
begin
    -- Resolve the internal user created by the auth trigger (must not insert)
    select id into v_user_id
    from public.users
    where auth_uid = p_auth_uid;

    if v_user_id is null then
        raise exception 'internal user not found for auth_uid %', p_auth_uid;
    end if;

    -- Reuse existing workspace for this owner if present, otherwise create one
    select id into v_workspace_id from public.workspaces where owner_id = v_user_id;

    if v_workspace_id is null then
      insert into public.workspaces (name, owner_id)
      values (p_business_name, v_user_id)
      returning id into v_workspace_id;
    end if;

    -- Ensure workspace_members row exists (no duplicate)
    insert into public.workspace_members (workspace_id, user_id, role)
    select v_workspace_id, v_user_id, 'member'
    where not exists (
      select 1 from public.workspace_members where workspace_id = v_workspace_id and user_id = v_user_id
    );

    -- Ensure admin_access row exists (no duplicate)
    insert into public.admin_access (workspace_id, user_id, role)
    select v_workspace_id, v_user_id, 'admin'
    where not exists (
      select 1 from public.admin_access where workspace_id = v_workspace_id and user_id = v_user_id
    );
end;
$$;

-- Lock down permissions and allow execution via PostgREST roles
revoke all on function public.rpc_create_user_profile from public;
grant execute on function public.rpc_create_user_profile to anon;
grant execute on function public.rpc_create_user_profile to authenticated;
