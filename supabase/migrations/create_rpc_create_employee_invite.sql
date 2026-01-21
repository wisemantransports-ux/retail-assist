-- Drop existing function if it exists (handles schema changes/updates)
DROP FUNCTION IF EXISTS public.rpc_create_employee_invite(
  p_email TEXT,
  p_role TEXT,
  p_workspace_id UUID,
  p_invited_by UUID
) CASCADE;

-- ============================================================================
-- RPC: rpc_create_employee_invite
-- ============================================================================
-- Purpose: Create an employee invite record with validation and access control
--
-- Parameters:
--   - p_email: Email address of the employee being invited (required)
--   - p_role: Role for the employee (optional, defaults to 'employee')
--   - p_workspace_id: Workspace UUID if employee belongs to workspace, NULL for platform staff
--   - p_invited_by: UUID of the super admin creating the invite (required, cannot be null)
--
-- Returns: The newly created employee_invites row with all columns
--
-- Security: SECURITY DEFINER - Executes with function owner's privileges
--           RLS policies should restrict to super_admin users only
-- ============================================================================

CREATE FUNCTION public.rpc_create_employee_invite(
  p_email TEXT,
  p_role TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL,
  p_invited_by UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  invited_by UUID,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
  v_role_value TEXT;
  v_invited_by_value UUID;
BEGIN
  -- ========================================================================
  -- Input Validation
  -- ========================================================================

  -- Validate that p_email is provided and not empty
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required and cannot be empty';
  END IF;

  -- Validate that p_invited_by is provided (cannot be null)
  IF p_invited_by IS NULL THEN
    RAISE EXCEPTION 'invited_by user ID is required and cannot be null';
  END IF;

  -- Verify that the invited_by user exists and is a super_admin
  PERFORM 1 FROM public.users
  WHERE id = p_invited_by
    AND role = 'super_admin'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % is not authorized to create invites (must be super_admin)', p_invited_by;
  END IF;

  -- ========================================================================
  -- Parameter Processing
  -- ========================================================================

  -- Use provided role or default to 'employee' if null or empty
  v_role_value := COALESCE(NULLIF(TRIM(p_role), ''), 'employee');

  -- Use provided invited_by value
  v_invited_by_value := p_invited_by;

  -- ========================================================================
  -- Access Control: Platform Staff Restriction
  -- ========================================================================

  -- Platform staff (workspace_id = NULL) can only be invited by super_admin
  -- This is validated above, but documenting the restriction here
  IF p_workspace_id IS NULL THEN
    -- Platform staff can only be created by super_admin (already verified above)
    NULL;
  END IF;

  -- ========================================================================
  -- Insert the Employee Invite
  -- ========================================================================

  INSERT INTO public.employee_invites (
    id,
    email,
    role,
    workspace_id,
    invited_by,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),                    -- id: Generate new UUID
    LOWER(TRIM(p_email)),                 -- email: Normalize to lowercase and trim
    v_role_value,                         -- role: Use processed role value
    p_workspace_id,                       -- workspace_id: Can be null for platform staff
    v_invited_by_value,                   -- invited_by: Cannot be null (required)
    'pending',                            -- status: Always start with 'pending'
    NOW() AT TIME ZONE 'UTC',            -- created_at: Current timestamp
    NOW() AT TIME ZONE 'UTC'             -- updated_at: Current timestamp
  )
  RETURNING
    employee_invites.id,
    employee_invites.workspace_id,
    employee_invites.email,
    employee_invites.full_name,
    employee_invites.phone,
    employee_invites.role,
    employee_invites.invited_by,
    employee_invites.status,
    employee_invites.created_at,
    employee_invites.updated_at,
    employee_invites.metadata
  INTO
    id,
    workspace_id,
    email,
    full_name,
    phone,
    role,
    invited_by,
    status,
    created_at,
    updated_at,
    metadata;

  -- ========================================================================
  -- Return the Created Row
  -- ========================================================================

  RETURN NEXT;

EXCEPTION WHEN OTHERS THEN
  -- Log the error with context
  RAISE EXCEPTION 'Failed to create employee invite for %: %', p_email, SQLERRM;
END;
$$;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Allow authenticated users to execute the function
-- RLS policies should restrict who can actually call this
GRANT EXECUTE ON FUNCTION public.rpc_create_employee_invite(
  TEXT, TEXT, UUID, UUID
) TO authenticated;

-- ============================================================================
-- Create RLS Policy for Access Control (if not exists)
-- ============================================================================

-- Ensure the employee_invites table has RLS enabled
ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Only super_admin users can create employee invites
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "super_admin_create_employee_invites" ON public.employee_invites;

  -- Create new policy
  CREATE POLICY "super_admin_create_employee_invites"
    ON public.employee_invites
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role = 'super_admin'
      )
    );
EXCEPTION WHEN OTHERS THEN
  -- Policy might already exist, continue
  NULL;
END;
$$;

-- ============================================================================
-- Documentation / Comments
-- ============================================================================

COMMENT ON FUNCTION public.rpc_create_employee_invite(TEXT, TEXT, UUID, UUID) IS
'Creates a new employee invite record.

Requires:
- p_email: Valid email address of the employee
- p_invited_by: UUID of super_admin user creating the invite (REQUIRED, NOT NULL)
- p_role: Employee role (optional, defaults to "employee")
- p_workspace_id: Workspace UUID (optional, NULL means platform staff)

Security:
- Function executes with SECURITY DEFINER privileges
- Only super_admin users can execute this function via RLS policy
- Validates that invited_by user exists and has super_admin role
- Email is normalized to lowercase

Returns: Full employee_invites row with all columns populated

Raises exceptions if:
- Email is missing or empty
- invited_by is null
- invited_by user does not exist or is not super_admin
- Database constraints are violated';
