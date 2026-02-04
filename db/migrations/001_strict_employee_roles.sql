-- 001_strict_employee_roles.sql
-- Enforce workspace rules for employee invitations
-- - If invited_by_role = 'super_admin' → workspace_id MUST be NULL
-- - If invited_by_role = 'client_admin' → workspace_id MUST be set (NOT NULL)
-- This migration adds a trigger to validate inserts and prevents invalid state.

BEGIN;

-- Create validation function
CREATE OR REPLACE FUNCTION enforce_employee_workspace_rules()
RETURNS trigger AS $$
BEGIN
  -- Only run for inserts
  IF (TG_OP = 'INSERT') THEN
    -- super_admin invites must not have workspace_id
    IF (NEW.invited_by_role = 'super_admin') THEN
      IF (NEW.workspace_id IS NOT NULL) THEN
        RAISE EXCEPTION 'super_admin invites must have workspace_id = NULL';
      END IF;
    END IF;

    -- client_admin invites must provide workspace_id
    IF (NEW.invited_by_role = 'client_admin') THEN
      IF (NEW.workspace_id IS NULL) THEN
        RAISE EXCEPTION 'client_admin invites must provide workspace_id';
      END IF;
    END IF;

    -- Employees always have role = 'employee' enforced at insert
    IF (NEW.role IS DISTINCT FROM 'employee') THEN
      RAISE EXCEPTION 'employees.role must be ''employee'' on insert';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to employees table
DROP TRIGGER IF EXISTS trg_enforce_employee_workspace_rules ON employees;
CREATE TRIGGER trg_enforce_employee_workspace_rules
BEFORE INSERT ON employees
FOR EACH ROW EXECUTE FUNCTION enforce_employee_workspace_rules();

COMMIT;
