-- =============================================
-- 0042_create_employee_invites.sql
-- Create employee_invites table and system invite
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  workspace_id UUID REFERENCES public.workspaces(id),
  role TEXT NOT NULL,
  full_name TEXT,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Insert system employee invite idempotent
INSERT INTO public.employee_invites(
    id, email, workspace_id, role, full_name, accepted, created_at, updated_at
)
SELECT
    '00000000-0000-0000-0000-000000000100'::UUID,
    'system@retail-assist.local',
    w.id,
    'employee',
    'System Employee',
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM public.workspaces w
WHERE NOT EXISTS (
    SELECT 1
    FROM public.employee_invites ei
    WHERE ei.email = 'system@retail-assist.local'
);

COMMIT;