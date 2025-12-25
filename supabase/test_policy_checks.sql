-- Test & Verification snippets for Supabase RLS and read-only behavior
-- Run the SQL sections in the Supabase SQL editor (service role) for inspection
-- Use the curl/PostgREST examples below to test actual RLS enforcement as an authenticated user (requires user JWT)

-- 1) Inspect key tables (service role)
SELECT 'workspaces' as table, count(*) FROM workspaces;
SELECT id, name, subscription_status FROM workspaces ORDER BY created_at DESC LIMIT 10;
SELECT id, auth_uid, email, full_name FROM users ORDER BY created_at DESC LIMIT 10;
SELECT id, workspace_id, user_id, role FROM workspace_members ORDER BY created_at DESC LIMIT 20;

-- 2) Update a workspace subscription_status (service role only)
-- Replace <WORKSPACE_ID> with your workspace id
-- Set to 'pending' to test read-only blocking
UPDATE workspaces SET subscription_status = 'pending' WHERE id = '<WORKSPACE_ID>';
-- Set to 'active' to allow writes
-- UPDATE workspaces SET subscription_status = 'active' WHERE id = '<WORKSPACE_ID>';

-- 3) Check agents (service role)
SELECT * FROM agents WHERE workspace_id = '<WORKSPACE_ID>' ORDER BY created_at DESC LIMIT 10;

-- 4) Confirm RLS blocks writes from a normal user (use REST / PostgREST or client with user JWT)
-- Example: attempt to create an agent (this must be run as the user via REST or supabase-js using user JWT)

-- REST example (curl): replace placeholders
-- Obtain a user's JWT from Supabase Auth (sign-in or use the Access Token from the Auth panel)
-- Then run:
--
-- curl -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/agents" \
--  -H "Authorization: Bearer <USER_JWT>" \
--  -H "apikey: <ANON_KEY>" \
--  -H "Content-Type: application/json" \
--  -d '{"workspace_id":"<WORKSPACE_ID>","name":"Test Agent from User","description":"Should be blocked if workspace pending"}'
--
-- Expected: HTTP 401/403 or 429 depending on supabase/postgrest error when RLS rejects.

-- 5) Confirm reads succeed for workspace members
-- Example: list agents (as the user using the same pattern)
-- curl -X GET "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/agents?workspace_id=eq.<WORKSPACE_ID>" \
--  -H "Authorization: Bearer <USER_JWT>" \
--  -H "apikey: <ANON_KEY>"
-- Expected: 200 with array of agents (empty or populated)

-- 6) Validate write allowed when workspace is active (service role enables update to active)
-- As service role (SQL editor), run:
-- UPDATE workspaces SET subscription_status = 'active' WHERE id = '<WORKSPACE_ID>';
-- Then retry the curl POST to create agent with the user's JWT — Expected: 201 created and returned record

-- 7) Test workspace members listing (as user)
-- curl -X GET "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.<WORKSPACE_ID>&select=role,users(id,auth_uid,email,full_name)" \
--  -H "Authorization: Bearer <USER_JWT>" \
--  -H "apikey: <ANON_KEY>"

-- 8) Service-role SQL checks to confirm rows
SELECT count(*) FROM agents WHERE workspace_id = '<WORKSPACE_ID>';
SELECT * FROM workspace_members WHERE workspace_id = '<WORKSPACE_ID>';

-- 9) Quick script (bash) to run the REST checks (replace variables)
--
-- ```bash
-- SUPABASE_URL="https://your-project.supabase.co"
-- ANON_KEY="your-anon-key"
-- USER_JWT="user-jwt-here"
-- WID="<WORKSPACE_ID>"
-- curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST "${SUPABASE_URL}/rest/v1/agents" \
--   -H "Authorization: Bearer ${USER_JWT}" -H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" \
--   -d '{"workspace_id":"'"${WID}"'","name":"curl-test-agent"}'
-- ```

-- NOTES
-- - Run the curl/PostgREST checks using a real user's JWT to exercise RLS as the client would.
-- - The Supabase SQL editor runs as service role; auth.uid() will be empty there. Use SQL editor for administrative changes (updating subscription_status) and the REST/API calls to test real-user access.
-- - If you prefer a small Node script to run these checks programmatically with the Supabase JS client and an email/password auth sign-in for the test user, tell me and I'll add it.
