-- =============================================
-- 0043_fix_employee_auth_and_role_integrity.sql
-- Purpose: Add missing employees.auth_uid, backfill and keep in sync;
--          enforce canonical role authority on public.users (only 'super_admin' or NULL);
--          and enforce mutual exclusion between public.admin_access and public.employees.
--
-- Constraints: Idempotent; uses ALTER TABLE / triggers / constraints only; safe to re-run.
-- =============================================

BEGIN;

-- ====================================================================
-- 1) Add employees.auth_uid column (if missing), index, and backfill
--    Rationale: application login queries employees.auth_uid. Backfill
--    from public.users.auth_uid via employees.user_id so existing rows work.
-- ====================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_uid UUID;

CREATE INDEX IF NOT EXISTS idx_employees_auth_uid ON public.employees(auth_uid);

-- Backfill: populate any NULL or mismatched auth_uid values from public.users
UPDATE public.employees e
SET auth_uid = u.auth_uid
FROM public.users u
WHERE e.user_id = u.id
  AND (e.auth_uid IS NULL OR e.auth_uid <> u.auth_uid);

-- ====================================================================
-- 2) Ensure employees.auth_uid stays in sync on future INSERT/UPDATE
--    and when users.auth_uid changes.
--    Uses triggers: BEFORE INSERT/UPDATE on employees to set auth_uid, and
--    AFTER UPDATE OF auth_uid on users to propagate changes.
-- ====================================================================

-- Function: set employees.auth_uid from users.auth_uid before insert/update
CREATE OR REPLACE FUNCTION public.sync_employee_auth_uid()
RETURNS TRIGGER AS $$
DECLARE
  v_auth_uuid UUID;
BEGIN
  -- Resolve the auth_uid for the referenced user_id (if present)
  IF NEW.user_id IS NOT NULL THEN
    SELECT auth_uid INTO v_auth_uuid FROM public.users WHERE id = NEW.user_id LIMIT 1;
    IF v_auth_uuid IS NOT NULL THEN
      NEW.auth_uid := v_auth_uuid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop any existing trigger with this name (safe/idempotent) and recreate
DROP TRIGGER IF EXISTS trg_sync_employee_auth_uid ON public.employees;
CREATE TRIGGER trg_sync_employee_auth_uid
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_auth_uid();

-- Function: when users.auth_uid changes, propagate to employees linked by user_id
CREATE OR REPLACE FUNCTION public.propagate_user_auth_uid_to_employees()
RETURNS TRIGGER AS $$
BEGIN
  -- Update any employee rows that reference this internal user id
  UPDATE public.employees
  SET auth_uid = NEW.auth_uid
  WHERE user_id = NEW.id
    AND (auth_uid IS DISTINCT FROM NEW.auth_uid);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_propagate_user_auth_uid ON public.users;
CREATE TRIGGER trg_propagate_user_auth_uid
AFTER UPDATE OF auth_uid ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.propagate_user_auth_uid_to_employees();

-- ====================================================================
-- 3) Enforce canonical role authority in public.users
--    - Only allow role IS NULL or 'super_admin'
--    - Clear/normalize any other role values to NULL in a safe manner.
-- ====================================================================

-- Normalize existing values: keep only 'super_admin'; clear others.
UPDATE public.users
SET role = NULL
WHERE role IS NOT NULL
  AND role <> 'super_admin';

-- Add CHECK constraint to enforce allowed values (idempotent via existence check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_allowed_values_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_allowed_values_check
      CHECK (role IS NULL OR role = 'super_admin');
  END IF;
END;
$$;

-- ====================================================================
-- 4) Enforce mutual exclusion between admin_access <-> employees and prevent
--    super_admin users from having employee rows.
--    Implemented via triggers on employees and admin_access.
-- ====================================================================

-- Function: prevent inserting/updating an employees row when user is admin or super_admin
CREATE OR REPLACE FUNCTION public.check_employee_not_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOL;
  v_is_super_admin BOOL;
BEGIN
  -- Check admin_access membership for this internal user id
  SELECT EXISTS(SELECT 1 FROM public.admin_access aa WHERE aa.user_id = NEW.user_id) INTO v_is_admin;

  IF v_is_admin THEN
    RAISE EXCEPTION 'User cannot be both admin and employee (user_id=%). Remove admin_access first.', NEW.user_id;
  END IF;

  -- Check users.role for super_admin
  SELECT EXISTS(SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.role = ''super_admin'') INTO v_is_super_admin;

  IF v_is_super_admin THEN
    RAISE EXCEPTION 'Super admin cannot be an employee (user_id=%).', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to employees table (idempotent via DROP TRIGGER IF EXISTS)
DROP TRIGGER IF EXISTS trg_check_employee_not_admin ON public.employees;
CREATE TRIGGER trg_check_employee_not_admin
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.check_employee_not_admin();

-- Function: prevent inserting/updating an admin_access row when user is already an employee
CREATE OR REPLACE FUNCTION public.check_admin_not_employee()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.employees e WHERE e.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'User cannot be both employee and admin (user_id=%). Remove employee row first.', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_admin_not_employee ON public.admin_access;
CREATE TRIGGER trg_check_admin_not_employee
BEFORE INSERT OR UPDATE ON public.admin_access
FOR EACH ROW
EXECUTE FUNCTION public.check_admin_not_employee();

-- ====================================================================
-- 5) Safety: grant EXECUTE on new functions to public (keeps behavior consistent with other migrations)
--    These grants are best-effort and idempotent.
-- ====================================================================
GRANT EXECUTE ON FUNCTION public.sync_employee_auth_uid() TO public;
GRANT EXECUTE ON FUNCTION public.propagate_user_auth_uid_to_employees() TO public;
GRANT EXECUTE ON FUNCTION public.check_employee_not_admin() TO public;
GRANT EXECUTE ON FUNCTION public.check_admin_not_employee() TO public;

COMMIT;

-- End of 0043_fix_employee_auth_and_role_integrity.sql
-- NOTES:
--  - This migration uses only ALTER TABLE, triggers, functions, constraints, and updates.
--  - It is safe to re-run: all operations check existence or drop/recreate triggers/functions.
--  - It intentionally clears non-super_admin values from public.users.role so the
--    canonical representation for client admins is `public.admin_access`.
--  - It enforces mutual exclusion at the DB level so application assumptions are preserved.
