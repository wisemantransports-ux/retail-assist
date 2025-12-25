-- RLS policies and seed for minimal MVP
-- Depends on migration 003 which defines users, workspaces, workspace_members, is_read_only(), can_use_feature()

-- Enable row level security
alter table if exists users enable row level security;
alter table if exists workspaces enable row level security;
alter table if exists workspace_members enable row level security;

-- USERS table policies
-- Allow authenticated users to insert their own profile linking to auth.uid()
create policy "users_insert_own" on users for insert
  with check (auth.uid() is not null and auth.uid() = auth_uid);

-- Allow users to select and update their own record
create policy "users_select_own" on users for select using (auth.uid() = auth_uid);
create policy "users_update_own" on users for update using (auth.uid() = auth_uid) with check (auth.uid() = auth_uid);

-- WORKSPACES policies
-- SELECT: members (including owner) can read workspace
create policy "workspaces_select_members" on workspaces for select using (
  exists (
    select 1 from workspace_members wm
    join users u on u.id = wm.user_id
    where wm.workspace_id = workspaces.id and u.auth_uid = auth.uid()
  )
);

-- INSERT: authenticated users can create a workspace where they are the owner (owner.auth_uid must match)
create policy "workspaces_insert_owner" on workspaces for insert with check (
  (select auth_uid from users where id = owner_id limit 1) = auth.uid()
);

-- UPDATE/DELETE: only workspace owner or workspace admin members can update/delete
create policy "workspaces_update_owner_or_admin" on workspaces for update using (
  (
    -- owner match
    (select auth_uid from users where id = owner_id limit 1) = auth.uid()
  ) or (
    exists (
      select 1 from workspace_members wm
      join users u on u.id = wm.user_id
      where wm.workspace_id = workspaces.id and u.auth_uid = auth.uid() and wm.role = 'admin'
    )
  )
)
with check (
  (
    (select auth_uid from users where id = owner_id limit 1) = auth.uid()
  ) or (
    exists (
      select 1 from workspace_members wm
      join users u on u.id = wm.user_id
      where wm.workspace_id = workspaces.id and u.auth_uid = auth.uid() and wm.role = 'admin'
    )
  )
);

-- WORKSPACE_MEMBERS policies
-- SELECT: allow members to list members of their workspace
create policy "workspace_members_select_member" on workspace_members for select using (
  exists (
    select 1 from users u2
    where u2.auth_uid = auth.uid() and exists (
      select 1 from workspace_members wm2 where wm2.workspace_id = workspace_members.workspace_id and wm2.user_id = u2.id
    )
  )
);

-- INSERT: allow a user to insert their own membership (self-join) or allow workspace admins to add members
create policy "workspace_members_insert_self_or_admin" on workspace_members for insert with check (
  (
    -- inserting membership for self
    (select auth_uid from users where id = new.user_id limit 1) = auth.uid()
  ) or (
    -- or current user is admin of the workspace
    exists (
      select 1 from workspace_members wm
      join users u on u.id = wm.user_id
      where wm.workspace_id = new.workspace_id and u.auth_uid = auth.uid() and wm.role = 'admin'
    )
  )
);

-- UPDATE/DELETE: allow users to remove themselves or workspace admins
create policy "workspace_members_update_self_or_admin" on workspace_members for update using (
  (select auth_uid from users where id = user_id limit 1) = auth.uid() or exists (
    select 1 from workspace_members wm join users u on u.id = wm.user_id where wm.workspace_id = workspace_members.workspace_id and u.auth_uid = auth.uid() and wm.role = 'admin'
  )
)
with check (
  (select auth_uid from users where id = user_id limit 1) = auth.uid() or exists (
    select 1 from workspace_members wm join users u on u.id = wm.user_id where wm.workspace_id = workspace_members.workspace_id and u.auth_uid = auth.uid() and wm.role = 'admin'
  )
);

-- Convenience policy: allow anon select on public view of a workspace for demo (optional)
-- create policy "workspaces_public_read" on workspaces for select using (subscription_status = 'active');

-- SEED data (replace auth_uid placeholders with actual auth.uid() values from your Supabase Auth users)
insert into users (id, auth_uid, email, full_name) values
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001','admin@local','Admin User')
  on conflict (id) do nothing;

-- Demo active workspace owned by admin
insert into workspaces (id, owner_id, name, plan_type, subscription_status, payment_status, plan_limits)
values (
  '22222222-2222-2222-2222-222222222222',
  (select id from users where auth_uid = '00000000-0000-0000-0000-000000000001' limit 1),
  'Demo Workspace', 'pro', 'active', 'paid', '{"maxPages":3,"hasInstagram":true,"hasAiResponses":true,"commentToDmLimit":500}'::jsonb
)
on conflict (id) do nothing;

-- Demo member user (free/read-only)
insert into users (id, auth_uid, email, full_name) values
  ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000002','client@local','Demo Client')
on conflict (id) do nothing;

-- Read-only workspace owned by demo client (pending subscription)
insert into workspaces (id, owner_id, name, plan_type, subscription_status, payment_status, plan_limits)
values (
  '44444444-4444-4444-4444-444444444444',
  (select id from users where auth_uid = '00000000-0000-0000-0000-000000000002' limit 1),
  'Demo ReadOnly Workspace', 'starter', 'pending', 'unpaid', '{"maxPages":1,"hasInstagram":false,"hasAiResponses":false,"commentToDmLimit":0}'::jsonb
)
on conflict (id) do nothing;

-- Memberships
insert into workspace_members (workspace_id, user_id, role) values
  ('22222222-2222-2222-2222-222222222222', (select id from users where auth_uid = '00000000-0000-0000-0000-000000000001' limit 1), 'admin')
on conflict do nothing;

insert into workspace_members (workspace_id, user_id, role) values
  ('44444444-4444-4444-4444-444444444444', (select id from users where auth_uid = '00000000-0000-0000-0000-000000000002' limit 1), 'admin')
on conflict do nothing;
