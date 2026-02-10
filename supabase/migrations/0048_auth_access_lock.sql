-- =====================================================
-- Migration 0048
-- Auth & Access Control Lock
-- =====================================================

begin;

-- -----------------------------------------------------
-- 1. ENFORCE VALID ROLES (FINAL)
-- -----------------------------------------------------
alter table public.users
drop constraint if exists users_role_allowed_values_check;

alter table public.users
add constraint users_role_allowed_values_check
check (
  role in ('super_admin', 'admin', 'employee')
);

-- -----------------------------------------------------
-- 2. ENSURE auth_uid IS UNIQUE & REQUIRED
-- -----------------------------------------------------
alter table public.users
alter column auth_uid set not null;

create unique index if not exists users_auth_uid_unique
on public.users (auth_uid);

-- -----------------------------------------------------
-- 3. FINAL RPC: rpc_get_user_access
-- -----------------------------------------------------
drop function if exists public.rpc_get_user_access();

create function public.rpc_get_user_access()
returns table (
  user_id uuid,
  role text,
  workspace_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Disable RLS inside RPC (required in Supabase)
  perform set_config('row_security', 'off', true);

  return query
  select
    u.id,
    u.role,
    coalesce(e.workspace_id, u.workspace_id)
  from public.users u
  left join public.employees e
    on e.user_id = u.id
  where u.auth_uid = auth.uid();
end;
$$;

grant execute on function public.rpc_get_user_access()
to authenticated;

-- -----------------------------------------------------
-- 4. RLS POLICIES (READ-ONLY, SELF-SCOPED)
-- -----------------------------------------------------

-- USERS
alter table public.users enable row level security;

drop policy if exists users_self_read on public.users;
create policy users_self_read
on public.users
for select
using (auth_uid = auth.uid());

-- EMPLOYEES
alter table public.employees enable row level security;

drop policy if exists employees_self_read on public.employees;
create policy employees_self_read
on public.employees
for select
using (auth_uid = auth.uid());

commit;