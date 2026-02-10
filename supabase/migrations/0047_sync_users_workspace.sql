-- 0047_sync_users_workspace.sql
-- Purpose: Sync workspace_id for newly created employees

begin;

update public.users u
set workspace_id = e.workspace_id
from employees e
where u.id = e.user_id
  and u.role = 'employee';

commit;