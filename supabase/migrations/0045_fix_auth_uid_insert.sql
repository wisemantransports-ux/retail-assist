-- 0045_fix_auth_uid_insert.sql
-- Purpose: Populate auth_uid during auth user creation

begin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    auth_uid,
    email,
    created_at
  )
  values (
    gen_random_uuid(),
    new.id,
    new.email,
    now()
  )
  on conflict (auth_uid) do nothing;

  return new;
end;
$$;

commit;