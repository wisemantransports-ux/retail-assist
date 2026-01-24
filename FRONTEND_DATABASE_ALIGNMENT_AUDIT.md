# Frontend-Database Alignment Audit Report

## Executive Summary

The Next.js + Supabase application has **signup and invite flows that will fail due to missing database columns, broken RLS policies, and incorrect RPC functions**. This audit identifies all gaps between what the frontend expects and what the database provides.

**Status**: ❌ **NOT PRODUCTION READY**

**Fix**: Run migration `038_comprehensive_signup_invite_flow_migration.sql` 

---

## 1. Frontend Code Analysis

### 1.1 Signup Flow (`app/auth/signup/page.tsx` → `app/api/auth/signup/route.ts`)

**Flow**: User signs up → Auth created → RPC called → Internal profile created → Session created

**Expected Database State After Signup**:
```
auth.users row:
  id = <auth_uid>
  email = user@example.com

public.users row:
  auth_uid = <auth_uid>
  email = user@example.com
  business_name = "Test Corp"
  phone = "+1234567890"
  plan_type = "starter"
  role = NULL (for regular admin) OR 'super_admin' (if p_is_super_admin=true)

public.workspaces row:
  owner_id = <users.id>
  name = "Test Corp"

public.admin_access row:
  user_id = <users.id>
  workspace_id = <workspaces.id>
  role = "admin"
```

**Required RPC**: `rpc_create_user_profile(auth_uid, business_name, email, full_name, phone, plan_type, is_super_admin)`

**Actual Database State**: ❌ Many columns missing from `users` table

### 1.2 Invite Flow (`app/invite/invite-form.tsx` → `app/api/employees/accept-invite/route.ts`)

**Flow**: 
1. Admin invites employee → Token created → Invite stored
2. Employee receives invite link with token
3. Employee submits form → New auth user created → Employee profile linked → Role set

**API Endpoint**: `POST /api/employees/accept-invite?token=<token>`

**Request Body**:
```json
{
  "email": "employee@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "SecurePass123!"
}
```

**Expected Database State After Accept**:
```
auth.users row:
  id = <new_auth_uid>
  email = employee@example.com

public.users row:
  auth_uid = <new_auth_uid>
  email = employee@example.com

public.employees row:
  user_id = <users.id>
  workspace_id = <workspace_uuid>
  full_name = "John Doe"
  phone = <from invite or null>
  is_active = true

public.workspace_members row:
  user_id = <users.id>
  workspace_id = <workspace_uuid>
  role = "member"

public.employee_invites row (UPDATED):
  status = "accepted"
  accepted_at = NOW()
  full_name = "John Doe"
```

**Critical RLS Requirements**:
- ✅ `employee_invites` must be readable by **unauthenticated users** (to find invite by token)
- ✅ `employee_invites` must be insertable by **admins of that workspace**
- ✅ `employees` must be readable by workspace admins

**Actual State**: ❌ RLS policies too restrictive; unauthenticated users cannot read invites

### 1.3 Employee Access (`app/api/employees/route.ts`)

**GET Flow**: Admin calls `GET /api/employees` → Lists all employees in their workspace

**Expected Query**:
```
SELECT id, user_id, workspace_id, is_active, created_at, updated_at 
FROM employees 
WHERE workspace_id = <admin's_workspace_id>
```

**Database Requirement**: 
- `employees` table must have `workspace_id` column
- Column must be NOT NULL (employees belong to exactly ONE workspace)
- RLS policy must allow admins to read their workspace's employees

**Actual State**: ✅ (Mostly correct after 034-035 migrations)

---

## 2. Database Schema Audit

### 2.1 `users` Table

**Current Schema** (from `002_complete_schema.sql`):
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  api_key TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Missing Columns**:
| Column | Type | Required For | Status |
|--------|------|--------------|--------|
| `role` | TEXT | `rpc_get_user_access` to identify super_admin | ❌ MISSING |
| `business_name` | TEXT | Signup flow stores business name | ❌ MISSING |
| `phone` | TEXT | Signup flow stores phone; employee invites store phone | ❌ MISSING |
| `plan_type` | TEXT | Plan tracking for invitations | ❌ MISSING |

**Issues**:
- ❌ No `role` column → `rpc_get_user_access` fails when checking `u.role = 'super_admin'`
- ❌ No `business_name` → Signup RPC tries to insert but column doesn't exist
- ❌ No `phone` → Signup RPC tries to insert but column doesn't exist
- ❌ No `plan_type` → Signup flow expects to store plan, would fail

---

### 2.2 `admin_access` Table

**Current Schema** (from `037_create_admin_access_table.sql`):
```sql
CREATE TABLE IF NOT EXISTS public.admin_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, workspace_id)
);
```

**Status**: ✅ Table exists and has correct structure

**Issues**:
- ❌ RLS policies assume `auth.uid()` directly maps to `user_id`, but should join via `users.auth_uid`

---

### 2.3 `employees` Table

**Current Schema** (from `030_employees_dashboard.sql`):
```sql
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, business_id)
);
```

**After Migration 034-035**:
```sql
ALTER TABLE employees ADD COLUMN workspace_id uuid;
ALTER TABLE employees ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE employees DROP COLUMN business_id;
```

**Current Status**: ⚠️ Has `workspace_id` NOT NULL, but...

**Missing Columns**:
| Column | Type | Required For | Status |
|--------|------|--------------|--------|
| `full_name` | TEXT | Employee profile display | ❌ MISSING |
| `phone` | TEXT | Employee contact info | ❌ MISSING |

**Issues**:
- ❌ `full_name` not stored → Employee dashboard cannot display name
- ❌ `phone` not stored → Cannot contact employee

---

### 2.4 `employee_invites` Table

**Current Schema** (from `032_create_employee_invite.sql`):
```sql
CREATE TABLE if not exists public.employee_invites (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    email text not null,
    invited_by uuid not null references public.users(id) on delete set null,
    role text not null default 'employee',
    token text not null unique,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    accepted_at timestamptz,
    expires_at timestamptz default (now() + interval '30 days')
);
```

**After Migration 033** (adds `full_name`):
```sql
alter table public.employee_invites 
add column if not exists full_name text;
```

**After Migration 036** (ensures `expires_at`):
```sql
ALTER TABLE public.employee_invites 
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');
```

**Status**: ✅ Table exists with all required columns

**Issues**:
- ❌ RLS policy too restrictive - doesn't allow unauthenticated token lookup

---

### 2.5 RLS Policies Analysis

**Signup Flow RLS Requirements**:
- `users` table: Needs anon/authenticated INSERT (creates new user) → ✅ (or uses RPC)
- `workspaces` table: INSERT by owner → ✅ (via RPC)
- `admin_access` table: INSERT by super_admin → ✅ (via RPC)

**Invite Acceptance RLS Requirements**:
- `employee_invites`: SELECT by token (unauthenticated) → ❌ **BROKEN**
  - Current: `CREATE POLICY "employee_invites_read_workspace_admins" ... USING (EXISTS (SELECT 1 FROM public.admin_access ...))`
  - Problem: Unauthenticated users have no auth.uid(), so policy blocks them
  - Required: Allow unauthenticated SELECT by token lookup using service role key

**Actual Issue**: The route handler uses `supabaseService` (service role key) so RLS doesn't apply, but the policy definition is still wrong for future client-side usage.

---

## 3. RPC Function Audit

### 3.1 `rpc_create_user_profile`

**Location**: `024_create_rpc_create_user_profile.sql`

**Signature**:
```sql
CREATE OR REPLACE FUNCTION public.rpc_create_user_profile(
  p_auth_uid uuid,
  p_business_name text,
  p_email text,
  p_full_name text,
  p_phone text,
  p_plan_type text,
  p_is_super_admin boolean DEFAULT false
)
RETURNS void
```

**Called By**: `/app/api/auth/signup/route.ts`

**Expected Behavior**:
1. Create/update `users` row with `business_name`, `phone`, `plan_type`
2. Set `role = 'super_admin'` if `p_is_super_admin = true`
3. Create `workspaces` row if doesn't exist
4. Create `workspace_members` row
5. Create `admin_access` row

**Actual Issues**:
- ❌ `users.business_name` column doesn't exist → INSERT fails
- ❌ `users.phone` column doesn't exist → INSERT fails
- ❌ `users.plan_type` column doesn't exist → INSERT fails
- ❌ `users.role` column doesn't exist → Cannot set super_admin flag

**Impact**: Signup flow fails at RPC call

---

### 3.2 `rpc_get_user_access`

**Location**: `029_fix_get_user_access.sql`

**Signature**:
```sql
create or replace function public.rpc_get_user_access()
returns table (
  user_id uuid,
  workspace_id uuid,
  role text
)
```

**Called By**: 
- `/app/api/employees/route.ts` (GET)
- `/app/auth/signup/page.tsx` (client-side redirect)
- Role-based middleware

**Implementation**:
```sql
select
  u.id as user_id,
  null::uuid as workspace_id,
  'super_admin'::text as role,
  1 as priority
from public.users u
where u.auth_uid = auth.uid()
  and u.role = 'super_admin'  -- ❌ THIS COLUMN DOESN'T EXIST!
```

**Actual Issues**:
- ❌ References `u.role` column which doesn't exist in `users` table
- ❌ Query will fail with "column u.role does not exist"
- ❌ Breaks role resolution for all users

**Impact**: Cannot determine user's role; all permission checks fail

---

### 3.3 `rpc_accept_employee_invite`

**Location**: `033_accept_employee_invite.sql`

**Signature**:
```sql
create or replace function public.rpc_accept_employee_invite(
    p_token text,
    p_auth_uid uuid,
    p_full_name text,
    p_phone text
)
returns void
```

**Called By**: `/app/api/employees/accept-invite/route.ts` (via service role key)

**Implementation Issues**:
- ✅ Table schema looks correct
- ✅ Constraints look correct
- ❌ BUT: Tries to insert into `employees` with columns that don't exist:
  - `employees.full_name` - ✅ Adding in 038
  - `employees.phone` - ✅ Adding in 038

**Current Error**: If RPC is called, would fail on INSERT

---

## 4. Flow-by-Flow Failure Analysis

### Flow 1: Admin Signup - Where It Breaks

```
1. User fills form
   ↓
2. POST /api/auth/signup
   ├─ Create auth.users ✅
   ├─ Call rpc_create_user_profile ❌ FAILS HERE
   │  └─ Tries to INSERT users.business_name
   │     Error: column "business_name" does not exist
   └─ Return error to frontend
```

**Root Cause**: Missing `business_name` column in `users` table

---

### Flow 2: Employee Invite - Where It Breaks

```
1. Admin creates invite
   ├─ POST /api/employees/invite
   │  └─ Creates employee_invites row ✅
   └─ Invite link sent ✅
   
2. Employee opens invite link
   ├─ GET /invite?token=abc123
   │  └─ Loads invite form ✅
   
3. Employee submits form
   ├─ POST /api/employees/accept-invite?token=abc123
   │  ├─ Query employee_invites by token ✅
   │  ├─ Create auth.users ✅
   │  ├─ Call rpc_accept_employee_invite ❌ FAILS HERE
   │  │  └─ Tries to INSERT employees.full_name
   │  │     Error: column "full_name" does not exist
   │  └─ Return error to frontend
```

**Root Cause**: Missing `full_name` column in `employees` table

---

### Flow 3: List Employees - Where It Breaks

```
1. Admin navigates to /dashboard/employees
   ├─ GET /api/employees
   │  ├─ Get user role via rpc_get_user_access ❌ FAILS HERE
   │  │  └─ Tries to SELECT u.role FROM users
   │  │     Error: column "role" does not exist
   │  └─ Return error response
   └─ Frontend shows error
```

**Root Cause**: Missing `role` column in `users` table

---

## 5. Data Integrity Issues

### Issue 1: No Constraint Preventing Multi-Workspace Employees

**Problem**: An employee could theoretically be in multiple workspaces, but should be in exactly one.

**Current State**: 
- Migration 034 adds: `CREATE UNIQUE INDEX uniq_employee_single_workspace ON public.employees (user_id) WHERE workspace_id IS NOT NULL;`
- This is a partial unique index, which helps but could still allow NULL workspace_id

**Fix**: 038 ensures `workspace_id` is NOT NULL and tightens constraints

---

### Issue 2: No Trigger Preventing Admin + Employee

**Problem**: Nothing prevents a user from being both admin and employee simultaneously (should never happen).

**Current State**: 
- Migration 035 creates a TRIGGER: `check_employee_not_admin_before_insert`
- But trigger is only checked on INSERT, not when admin_access is added

**Fix**: 038 ensures proper ordering in RPC functions

---

### Issue 3: Missing Auth Trigger for New Auth Users

**Problem**: When user signs up via auth.createUser, no `users` record is auto-created.

**Current State**:
- Migration 002 defines `handle_new_auth_user()` trigger
- But if auth user is created outside the app (e.g., via CLI), `users` record might not exist

**Fix**: 038 recreates the trigger and adds safety checks in RPC

---

## 6. Missing Indexes

**Performance Issue**: No indexes on frequently queried columns

**Current**: 
- ✅ `idx_admin_access_user_id`
- ✅ `idx_admin_access_workspace_id`
- ✅ `idx_employee_invites_token`
- ❌ `idx_users_email_lowercase` - Missing, will slow email lookups

---

## 7. Summary of Changes Required

| Item | Type | Issue | Fix |
|------|------|-------|-----|
| `users.role` | Column | Missing | Add with CHECK constraint |
| `users.business_name` | Column | Missing | Add TEXT |
| `users.phone` | Column | Missing | Add TEXT |
| `users.plan_type` | Column | Missing | Add TEXT |
| `employees.full_name` | Column | Missing | Add TEXT |
| `employees.phone` | Column | Missing | Add TEXT |
| `admin_access` | RLS Policy | Wrong JOIN logic | Fix to use `auth.uid() → users.id` |
| `employee_invites` | RLS Policy | Too restrictive | Allow unauthenticated token lookup |
| `rpc_create_user_profile` | RPC | Missing columns | Update INSERT statement |
| `rpc_get_user_access` | RPC | Bad column reference | Fix `u.role` reference |
| `rpc_accept_employee_invite` | RPC | Missing columns | Update INSERT statement |
| Indexes | Index | Missing `users.email` | Add partial index for lowercase |

---

## 8. Migration Completeness Checklist

The provided migration `038_comprehensive_signup_invite_flow_migration.sql` addresses:

- ✅ All missing columns
- ✅ All broken RLS policies  
- ✅ All RPC functions
- ✅ Auth user trigger
- ✅ Data integrity constraints
- ✅ Indexes
- ✅ Backward compatibility (uses IF NOT EXISTS)
- ✅ Transaction safety (wrapped in BEGIN/COMMIT)

---

## 9. What Works After Migration

✅ **New admin can sign up** → Profile created → Workspace created → Can access dashboard

✅ **Admin can invite employees** → Invite created → Token generated → Email sent

✅ **Employee can accept invite** → Auth user created → Employee profile linked → Can access employee dashboard

✅ **Multi-account support** → Multiple users, workspaces, and employees work correctly

✅ **Role-based access** → Users see only their authorized data

✅ **Data integrity** → Cannot create invalid states

---

## 10. Post-Migration Testing

Run these to verify:

```sql
-- Test 1: Schema verification
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('role', 'business_name', 'phone', 'plan_type');

-- Test 2: RPC test
SELECT * FROM public.rpc_get_user_access();

-- Test 3: RLS verification
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('users', 'admin_access', 'employees', 'employee_invites');

-- Test 4: Data integrity
SELECT COUNT(*) FROM public.employees WHERE workspace_id IS NULL;
SELECT COUNT(*) FROM public.admin_access WHERE workspace_id IS NULL AND role != 'super_admin';
```

All should show correct state.

---

## Conclusion

**Current State**: ❌ Application cannot handle signup or invites

**After Migration 038**: ✅ All flows should work end-to-end

**Recommended**: Run migration in dev first, test thoroughly, then deploy to production
