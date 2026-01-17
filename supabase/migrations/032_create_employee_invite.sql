-- =============================================
-- 032_create_employee_invites.sql
-- Table and RPC for employee invites
-- ONLY client admins can invite employees to their workspace
-- ONLY super admin can invite platform_staff
-- =============================================

-- 1️⃣ Create table for employee invites
create table if not exists public.employee_invites (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    email text not null,
    invited_by uuid not null references public.users(id) on delete set null,
    role text not null default 'employee', -- 'employee' for client staff, 'platform_staff' for admins (super admin only)
    token text not null unique,            -- secure random token for acceptance
    status text not null default 'pending', -- 'pending', 'accepted', 'revoked', 'expired'
    created_at timestamptz not null default now(),
    accepted_at timestamptz,
    expires_at timestamptz default (now() + interval '30 days') -- Invites expire after 30 days
);

-- Add index for token lookup (common operation)
CREATE INDEX IF NOT EXISTS idx_employee_invites_token ON public.employee_invites(token);
CREATE INDEX IF NOT EXISTS idx_employee_invites_workspace ON public.employee_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_employee_invites_status ON public.employee_invites(status);

-- 2️⃣ RPC to create employee invite
-- SECURITY: Only admins can create invites for their workspace
-- SECURITY: Only super admin can create platform_staff invites
create or replace function public.rpc_create_employee_invite(
    p_workspace_id uuid,
    p_email text,
    p_invited_by uuid,
    p_role text default 'employee'
)
returns table(
    invite_id uuid,
    token text
)
language plpgsql
security definer
as $$
declare
    v_token text;
    v_inviter_id uuid;
    v_is_admin boolean;
    v_is_super_admin boolean;
begin
    -- 1️⃣ Resolve inviter (from Supabase auth)
    select id into v_inviter_id
    from public.users
    where auth_uid = auth.uid();
    
    if v_inviter_id is null then
        raise exception 'Inviter user not found';
    end if;

    -- 2️⃣ Check if inviter is super_admin
    select role = 'super_admin' into v_is_super_admin
    from public.users
    where id = v_inviter_id;

    -- 3️⃣ Check if inviter is admin of this workspace
    select exists (
        select 1 from public.admin_access aa
        where aa.user_id = v_inviter_id
          and aa.workspace_id = p_workspace_id
    ) into v_is_admin;

    -- 4️⃣ CRITICAL: Authorization checks
    if p_role = 'platform_staff' then
        -- ONLY super_admin can invite platform_staff
        if not v_is_super_admin then
            raise exception 'Only super admin can invite platform_staff';
        end if;
        -- platform_staff must be invited to PLATFORM workspace
        if p_workspace_id != '00000000-0000-0000-0000-000000000001'::uuid then
            raise exception 'Platform staff must be invited to platform workspace only';
        end if;
    else
        -- For regular employees, only admins of that workspace can invite
        if not v_is_admin and not v_is_super_admin then
            raise exception 'Only workspace admin can invite employees';
        end if;
    end if;

    -- 5️⃣ Generate secure random token
    v_token := encode(gen_random_bytes(16), 'hex');

    -- 6️⃣ Create invite record
    insert into public.employee_invites(workspace_id, email, invited_by, role, token)
    values (p_workspace_id, p_email, v_inviter_id, p_role, v_token)
    returning id, token into invite_id, token;

    return next;
end;
$$;

-- 3️⃣ Lock down permissions
revoke all on table public.employee_invites from public;
grant select, insert on table public.employee_invites to authenticated;

revoke all on function public.rpc_create_employee_invite from public;
grant execute on function public.rpc_create_employee_invite to authenticated;

-- =============================================
-- END OF 032
-- =============================================