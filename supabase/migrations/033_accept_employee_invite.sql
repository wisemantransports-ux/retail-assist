-- =============================================
-- 033_accept_employee_invite.sql
-- Accept invite, create employee user, link to workspace
-- CRITICAL: Enforces employee scoping to single workspace
-- =============================================

create or replace function public.rpc_accept_employee_invite(
    p_token text,
    p_auth_uid uuid,
    p_full_name text,
    p_phone text
)
returns void
language plpgsql
security definer
as $$
declare
    v_invite record;
    v_user_id uuid;
begin
    -- 1️⃣ Find pending invite
    -- Fail if token is invalid or already used
    select *
    into v_invite
    from public.employee_invites
    where token = p_token
      and status = 'pending';

    if not found then
        raise exception 'Invalid or already used invite token';
    end if;

    -- 2️⃣ Resolve internal user
    -- All employees must have a corresponding user record
    select id into v_user_id from public.users where auth_uid = p_auth_uid;

    if v_user_id is null then
        raise exception 'Internal user not found for auth_uid %', p_auth_uid;
    end if;

    -- 3️⃣ CRITICAL: Check user is not already an employee in another workspace
    -- This enforces the rule: Each employee can belong to EXACTLY ONE workspace
    if exists (
        select 1 from public.employees
        where user_id = v_user_id
    ) then
        raise exception 'User is already an employee in another workspace';
    end if;

    -- 4️⃣ CRITICAL: Check user is not an admin (cannot be both admin and employee)
    if exists (
        select 1 from public.admin_access
        where user_id = v_user_id
    ) then
        raise exception 'User is already an admin and cannot be invited as employee';
    end if;

    -- 5️⃣ Add to workspace_members with 'member' role
    insert into public.workspace_members(workspace_id, user_id, role)
    select v_invite.workspace_id, v_user_id, 'member'
    where not exists (
        select 1 from public.workspace_members
        where workspace_id = v_invite.workspace_id and user_id = v_user_id
    );

    -- 6️⃣ Insert into employees table with workspace_id
    -- CRITICAL: This is the ONLY place an employee record should be created
    -- Each INSERT here enforces unique(user_id, workspace_id) constraint
    insert into public.employees(user_id, workspace_id, full_name, phone)
    select v_user_id, v_invite.workspace_id, p_full_name, p_phone
    where not exists (
        select 1 from public.employees
        where user_id = v_user_id
    );

    -- 7️⃣ Mark invite as accepted
    update public.employee_invites
    set status = 'accepted',
        accepted_at = now()
    where id = v_invite.id;

    -- 8️⃣ Log acceptance for audit trail
    insert into public.system_logs (
        level, workspace_id, user_id, action, message, metadata
    ) values (
        'info',
        v_invite.workspace_id,
        v_user_id,
        'employee_invite_accepted',
        'Employee accepted invite',
        jsonb_build_object('invite_id', v_invite.id, 'invited_by', v_invite.invited_by)
    );

end;
$$;

-- 6️⃣ Lock down permissions
revoke all on function public.rpc_accept_employee_invite from public;
grant execute on function public.rpc_accept_employee_invite to authenticated;

-- =============================================
-- END OF 033
-- =============================================