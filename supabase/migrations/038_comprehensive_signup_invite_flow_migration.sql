-- =============================================
-- 038_comprehensive_signup_invite_flow_migration_clean.sql
-- Complete migration for working signup and invite flows
-- =============================================
BEGIN;

-- =============================================
-- PHASE 1: FIX USERS TABLE
-- =============================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT NULL CHECK (role IN ('super_admin', 'admin', NULL));

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS business_name TEXT;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter' CHECK (plan_type IN ('starter', 'pro', 'enterprise'));

CREATE INDEX IF NOT EXISTS idx_users_email_lowercase ON public.users (LOWER(email));

-- =============================================
-- PHASE 2: FIX EMPLOYEES TABLE
-- =============================================
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_employee_single_workspace
ON public.employees (user_id) WHERE workspace_id IS NOT NULL;

-- =============================================
-- PHASE 3: FIX ADMIN_ACCESS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.admin_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_access_user_id ON public.admin_access(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_workspace_id ON public.admin_access(workspace_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_role ON public.admin_access(role);

-- =============================================
-- PHASE 4: FIX EMPLOYEE_INVITES TABLE
-- =============================================
ALTER TABLE public.employee_invites
ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE public.employee_invites
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days');

CREATE INDEX IF NOT EXISTS idx_employee_invites_token ON public.employee_invites(token);
CREATE INDEX IF NOT EXISTS idx_employee_invites_workspace ON public.employee_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_employee_invites_status ON public.employee_invites(status);
CREATE INDEX IF NOT EXISTS idx_employee_invites_expires_at ON public.employee_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_employee_invites_created_at ON public.employee_invites(created_at);

-- =============================================
-- PHASE 5: RLS POLICIES
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- USERS
DROP POLICY IF EXISTS users_self_read ON public.users;
CREATE POLICY users_self_read
ON public.users FOR SELECT
USING (auth.uid() = auth_uid);

DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update
ON public.users FOR UPDATE
USING (auth.uid() = auth_uid);

DROP POLICY IF EXISTS users_super_admin_read ON public.users;
CREATE POLICY users_super_admin_read
ON public.users FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users u WHERE u.auth_uid = auth.uid() AND u.role = 'super_admin'
    )
);

-- ADMIN_ACCESS
DROP POLICY IF EXISTS admin_access_read_own ON public.admin_access;
CREATE POLICY admin_access_read_own
ON public.admin_access FOR SELECT
USING (
    user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users u WHERE u.auth_uid = auth.uid() AND u.role = 'super_admin'
    )
);

DROP POLICY IF EXISTS admin_access_manage_workspace ON public.admin_access;
CREATE POLICY admin_access_manage_workspace
ON public.admin_access FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.admin_access aa
        WHERE aa.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
          AND aa.workspace_id = admin_access.workspace_id
          AND aa.role = 'admin'
    )
    OR EXISTS (
        SELECT 1 FROM public.users u WHERE u.auth_uid = auth.uid() AND u.role = 'super_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_access aa
        WHERE aa.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
          AND aa.workspace_id = admin_access.workspace_id
          AND aa.role = 'admin'
    )
    OR EXISTS (
        SELECT 1 FROM public.users u WHERE u.auth_uid = auth.uid() AND u.role = 'super_admin'
    )
);

-- EMPLOYEES
DROP POLICY IF EXISTS employees_admin_all ON public.employees;
CREATE POLICY employees_admin_all
ON public.employees FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.admin_access aa
        WHERE aa.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
          AND aa.workspace_id = employees.workspace_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_access aa
        WHERE aa.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
          AND aa.workspace_id = employees.workspace_id
    )
);

DROP POLICY IF EXISTS employees_self_read ON public.employees;
CREATE POLICY employees_self_read
ON public.employees FOR SELECT
USING (
    user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
);

DROP POLICY IF EXISTS employees_super_admin ON public.employees;
CREATE POLICY employees_super_admin
ON public.employees FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users u WHERE u.auth_uid = auth.uid() AND u.role = 'super_admin'
    )
);

-- EMPLOYEE_INVITES
DROP POLICY IF EXISTS employee_invites_admin_create ON public.employee_invites;
CREATE POLICY employee_invites_admin_create
ON public.employee_invites FOR INSERT
WITH CHECK (
    invited_by IN (
        SELECT user_id FROM public.admin_access aa
        WHERE aa.workspace_id = employee_invites.workspace_id
          AND aa.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
    )
);

DROP POLICY IF EXISTS employee_invites_unauthenticated_read ON public.employee_invites;
CREATE POLICY employee_invites_unauthenticated_read
ON public.employee_invites FOR SELECT
USING (true);

DROP POLICY IF EXISTS employee_invites_admin_read ON public.employee_invites;
CREATE POLICY employee_invites_admin_read
ON public.employee_invites FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.admin_access aa
        WHERE aa.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
          AND aa.workspace_id = employee_invites.workspace_id
    )
    OR EXISTS (
        SELECT 1 FROM public.users u WHERE u.auth_uid = auth.uid() AND u.role = 'super_admin'
    )
);

-- =============================================
-- PHASE 6: WORKSPACES & MEMBERS RLS
-- =============================================
DROP POLICY IF EXISTS workspace_owner_all ON public.workspaces;
CREATE POLICY workspace_owner_all
ON public.workspaces FOR ALL
USING (owner_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid()));

DROP POLICY IF EXISTS workspace_member_read ON public.workspaces;
CREATE POLICY workspace_member_read
ON public.workspaces FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        JOIN public.users u ON u.id = wm.user_id
        WHERE wm.workspace_id = workspaces.id
          AND u.auth_uid = auth.uid()
    )
    OR owner_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
);

DROP POLICY IF EXISTS workspace_members_read ON public.workspace_members;
CREATE POLICY workspace_members_read
ON public.workspace_members FOR SELECT
USING (
    workspace_id IN (
        SELECT wm2.workspace_id FROM public.workspace_members wm2
        WHERE wm2.user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid())
    )
);

-- =============================================
-- PHASE 7: RPC FUNCTIONS
-- =============================================
-- rpc_get_user_access (cleaned)
CREATE OR REPLACE FUNCTION public.rpc_get_user_access()
RETURNS TABLE (user_id uuid, workspace_id uuid, role text)
LANGUAGE sql SECURITY DEFINER AS $$
SELECT r.user_id, r.workspace_id, r.role
FROM (
    SELECT u.id AS user_id, NULL::uuid AS workspace_id, 'super_admin'::text AS role, 1 AS priority
    FROM public.users u
    WHERE u.auth_uid = auth.uid() AND u.role = 'super_admin'

    UNION ALL

    SELECT aa.user_id, aa.workspace_id, 'admin'::text AS role, 2 AS priority
    FROM public.admin_access aa
    JOIN public.users u ON u.id = aa.user_id
    WHERE u.auth_uid = auth.uid() AND aa.workspace_id IS NOT NULL

    UNION ALL

    SELECT e.user_id, e.workspace_id, 'employee'::text AS role, 3 AS priority
    FROM public.employees e
    JOIN public.users u ON u.id = e.user_id
    WHERE u.auth_uid = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM public.admin_access aa2 WHERE aa2.user_id = e.user_id)
      AND NOT EXISTS (SELECT 1 FROM public.users u3 WHERE u3.auth_uid = auth.uid() AND u3.role = 'super_admin')
) r
ORDER BY r.priority
LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_user_access FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_get_user_access TO authenticated;

COMMIT;
-- =============================================
-- END OF CLEAN 038 MIGRATION
-- =============================================