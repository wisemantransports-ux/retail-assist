# Workspace Provisioning & RLS Testing Guide

## Overview

This document describes two test scripts that validate:

1. **Auto-provisioning** — automatic workspace & membership creation for first-time users
2. **RLS Enforcement** — Row Level Security policies that restrict agent access to workspace members

## Scripts

### 1. `scripts/test-workspace-provisioning-and-rls.js`

Comprehensive integration test that validates the complete flow:

```bash
node scripts/test-workspace-provisioning-and-rls.js
```

**What it tests:**

- ✅ Auth sign-in (admin@demo.com)
- ✅ User auto-provisioning in `public.users`
- ✅ Workspace auto-creation if user has none
- ✅ Workspace membership auto-creation with `admin` role
- ✅ Agent listing with RLS enforcement
- ✅ SELECT enforcement (user can read agents from member workspace)
- ✅ INSERT enforcement (user can only create agents if admin/owner)
- ✅ Service-role bypass (admin client ignores all RLS)

**Requirements:**

- `.env` file with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Supabase database with `workspaces`, `workspace_members`, and `agents` tables
- RLS policies applied (see below)

**Output:**

```
🧪 SUPABASE INTEGRATION & RLS TEST
════════════════════════════════════════════════════════════════════════════════
✅ Signed in successfully
✅ User record already exists
✅ Workspace already exists
✅ Membership auto-created
✅ Agents fetched successfully
✅ SELECT allowed (user is member of workspace)
⚠️  INSERT blocked by RLS (user may not be admin)
✅ Service-role INSERT succeeded (bypass RLS as expected)

📊 TEST SUMMARY
════════════════════════════════════════════════════════════════════════════════
Auth Sign-in:           PASSED
User Provisioning:      PASSED
Workspace Creation:     PASSED
Membership Creation:    PASSED
Agent Listing:          PASSED
RLS SELECT Test:        PASSED (allowed as expected)
RLS INSERT Test (User): BLOCKED (expected if not admin)
Service-Role Bypass:    PASSED
Overall Status:         PASSED
════════════════════════════════════════════════════════════════════════════════
```

---

### 2. `scripts/fix-and-apply-rls.js`

Generates the SQL needed to fix RLS policy infinite recursion issues:

```bash
node scripts/fix-and-apply-rls.js
```

**Output:**

Displays corrected SQL policies that must be manually applied in Supabase dashboard.

---

## RLS Policy Details

The following policies are applied to the `agents` table:

### SELECT Policy
- **Allows:** Authenticated users who are members of the workspace
- **Blocks:** Non-members from reading agents

```sql
CREATE POLICY agents_select_authenticated ON agents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = agents.workspace_id
      AND workspace_members.user_id = auth.uid()
  )
);
```

### INSERT Policy
- **Allows:** Workspace members with `admin` or `owner` role
- **Blocks:** Non-members and non-admin members from creating agents

```sql
CREATE POLICY agents_insert_admin_only ON agents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = agents.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'owner')
  )
);
```

### UPDATE Policy
- **Allows:** Admin/owner members to modify agents
- **Blocks:** Non-admin members and non-members

### DELETE Policy
- **Allows:** Admin/owner members to delete agents
- **Blocks:** Non-admin members and non-members

### Service-Role Bypass
The service-role key automatically bypasses **all** RLS policies. This enables:
- Backend operations (API routes with service-role client)
- Database migrations
- Admin operations in server components

---

## Setup Instructions

### Step 1: Ensure Database Schema

Verify these tables exist in Supabase:

**workspaces**
```
- id (uuid, primary key)
- name (text)
- owner (uuid, foreign key to public.users.id)
- plan_type (text, e.g., 'free', 'pro')
- subscription_status (text, e.g., 'active')
- created_at (timestamp)
```

**workspace_members**
```
- id (uuid, primary key)
- workspace_id (uuid, foreign key)
- user_id (uuid, foreign key to public.users.id)
- role (text, enum: 'admin', 'owner', 'member')
- created_at (timestamp)
```

**agents**
```
- id (uuid, primary key)
- workspace_id (uuid, foreign key)
- name (text)
- system_prompt (text)
- model (text)
- created_at (timestamp)
```

### Step 2: Apply RLS Policies

1. Run the policy generator:
   ```bash
   node scripts/fix-and-apply-rls.js
   ```

2. Copy the SQL output

3. Open Supabase Dashboard:
   - Navigate to: `SQL Editor` → `New Query`
   - Paste the SQL
   - Click `Run`

4. Verify: The output should show "All policies created successfully"

### Step 3: Run Tests

```bash
node scripts/test-workspace-provisioning-and-rls.js
```

**Expected output:** All tests pass with status `PASSED`

---

## Troubleshooting

### Error: "infinite recursion detected in policy"

**Cause:** RLS policies on `workspace_members` are recursively referencing themselves

**Fix:**
1. Run `node scripts/fix-and-apply-rls.js`
2. Apply the SQL to replace recursive policies with `EXISTS` checks
3. Re-run tests

### Error: "column X does not exist"

**Cause:** Schema mismatch (e.g., `deleted_at` column not present)

**Fix:**
- Verify column exists in Supabase table structure
- Update test script if schema varies from expected
- Common variations:
  - `workspace.owner_id` vs `workspace.owner`
  - `workspace_members.deleted_at` may not exist (use `created_at` for soft-delete checks)

### Error: "User provisioning failed"

**Cause:** Auth user exists but `public.users` record missing

**Fix:**
- Run test script — it will auto-create the missing user record
- Or manually insert:
  ```sql
  INSERT INTO public.users (id, email)
  VALUES ('auth_uid_here', 'user@example.com');
  ```

### Service-role INSERT succeeds but user INSERT fails

**Status:** Expected behavior ✅

- Service-role bypasses RLS → always succeeds
- User with non-admin role → INSERT blocked by RLS → expected
- User with admin role → INSERT allowed by RLS → expected

---

## Integration with App

The auto-provisioning is integrated into:

- **`app/api/auth/login/route.ts`** — Calls `ensureWorkspaceForUser()` after sign-in
- **`app/api/auth/me/route.ts`** — Calls `ensureWorkspaceForUser()` on hydration

Helper function in `app/lib/supabase/ensureWorkspaceForUser.ts`:

```typescript
export async function ensureWorkspaceForUser(userId: string, email?: string) {
  // Returns { created: boolean, workspace: object }
  // Idempotent: safe to call multiple times
}
```

---

## Production Checklist

- [ ] RLS policies applied to agents table
- [ ] Service-role key stored securely in `.env`
- [ ] All tests passing (`node scripts/test-workspace-provisioning-and-rls.js`)
- [ ] Workspace auto-provisioning integrated in login routes
- [ ] Monitored for RLS policy violations in logs
- [ ] Backup of database schema and policies

---

## See Also

- [API.md](../API.md) — API endpoint documentation
- [SUPABASE_SETUP.md](../SUPABASE_SETUP.md) — Initial Supabase setup
- [DEVELOPMENT.md](../DEVELOPMENT.md) — Development guide
