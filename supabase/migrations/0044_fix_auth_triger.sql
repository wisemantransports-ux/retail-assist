-- 0044_fix_auth_trigger.sql
-- Purpose: Make auth user creation compatible with invite/signup flows

begin;

-- 1. Drop existing trigger
drop trigger if exists on_auth_user_created on auth.users;

-- 2. Replace function with SAFE version
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert MINIMAL user record
  insert into public.users (
    id,
    email,
    created_at
  )
  values (
    new.id,
    new.email,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 3. Recreate trigger
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

commit;