-- =========================================================
-- 0040_enforce_admin_workspace_constraints.sql
-- Enforces strict admin ↔ workspace integrity
-- =========================================================

BEGIN;

-- =========================================================
-- 1. CLIENT ADMIN → SINGLE WORKSPACE ENFORCEMENT
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_single_workspace_for_client_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = NEW.user_id
      AND u.role = 'client_admin'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM workspace_members wm
      WHERE wm.user_id = NEW.user_id
        AND wm.id <> NEW.id
    ) THEN
      RAISE EXCEPTION
        'client_admin % cannot belong to more than one workspace',
        NEW.user_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_workspace_client_admin
ON workspace_members;

CREATE CONSTRAINT TRIGGER trg_single_workspace_client_admin
AFTER INSERT OR UPDATE
ON workspace_members
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION enforce_single_workspace_for_client_admin();

-- =========================================================
-- 2. CLIENT ADMIN → SINGLE admin_access ROW
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_single_admin_access_for_client_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = NEW.user_id
      AND u.role = 'client_admin'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM admin_access aa
      WHERE aa.user_id = NEW.user_id
        AND aa.id <> NEW.id
    ) THEN
      RAISE EXCEPTION
        'client_admin % cannot have multiple admin_access records',
        NEW.user_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_admin_access_client_admin
ON admin_access;

CREATE CONSTRAINT TRIGGER trg_single_admin_access_client_admin
AFTER INSERT OR UPDATE
ON admin_access
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION enforce_single_admin_access_for_client_admin();

-- =========================================================
-- 3. SUPER ADMIN → NO WORKSPACE (HARD CHECK)
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'super_admin_workspace_null'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT super_admin_workspace_null
    CHECK (
      NOT (role = 'super_admin' AND workspace_id IS NOT NULL)
    );
  END IF;
END;
$$;

COMMIT;