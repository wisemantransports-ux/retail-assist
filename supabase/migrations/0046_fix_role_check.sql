-- 0046_fix_role_check.sql
-- Purpose: Allow valid application roles during auth creation

begin;

-- 1. Drop broken constraint
alter table public.users
drop constraint if exists users_role_allowed_values_check;

-- 2. Recreate correct constraint
alter table public.users
add constraint users_role_allowed_values_check
check (
  role is null
  or role in ('super_admin', 'admin', 'employee')
);

commit;