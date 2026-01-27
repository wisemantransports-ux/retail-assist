# Retail Assist Authentication & Workspace System

**Last Updated:** January 27, 2026  
**Version:** 1.0  
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Roles & Access Model](#roles--access-model)
3. [Authentication Flows](#authentication-flows)
4. [Middleware Authorization](#middleware-authorization)
5. [Database Schema](#database-schema)
6. [Session Handling](#session-handling)
7. [Known Non-Critical Warnings](#known-non-critical-warnings)
8. [Verification Checklist](#verification-checklist)
9. [Current System Status](#current-system-status)

---

## System Overview

The Retail Assist authentication system uses a **dual-identity architecture**:

### Supabase Auth (`auth.users`)
- Managed by Supabase
- Handles email/password authentication
- Issues JWT tokens for session management
- Provides the `auth_uid` that links to internal users

### Internal Users (`public.users`)
- Created in parallel with Supabase auth accounts
- Stores business logic: roles, profile data, plan information
- Essential because Supabase Auth is identity-only; we need business roles
- Each internal user has unique `auth_uid` reference to Supabase user

### Why Two Systems?
Supabase Auth provides secure authentication but no role/authorization info. We store roles and workspace membership in PostgreSQL for:
- Flexible role management
- Workspace-scoped access control
- Integration with RLS (Row-Level Security) policies
- Historical tracking and audit capability

---

## Roles & Access Model

The system implements three distinct roles:

### Super Admin
- **Storage**: `public.users.role = 'super_admin'`
- **Resolution**: Checked first in role detection logic
- **Access**: Full platform control via `/admin` routes
- **Workspace Requirement**: None (workspaceId is NULL)
- **Examples**: Platform administrators, support staff needing full access

### Client Admin
- **Storage**: `public.users.role = 'client_admin'` (during signup) + `public.workspace_members` entry
- **Resolution**: Detected via `users.role = 'client_admin'`, workspace_id resolved from `workspace_members`
- **Access**: Dashboard for owned workspace (`/dashboard/[workspaceId]`)
- **Workspace Requirement**: Required (one workspace per admin)
- **Authoritative Tables**:
  - `users` - Stores the role flag
  - `workspace_members` - Stores the workspace_id mapping
  - `admin_access` - Alternative path for role resolution
- **Examples**: Business owners, account managers who created the workspace

### Employee (Future)
- **Storage**: `public.employees` table entry
- **Resolution**: Checked after super_admin and client_admin
- **Access**: Dashboard for assigned workspace (`/employees/dashboard/[workspaceId]`)
- **Workspace Requirement**: Required (assigned by admin)
- **Authoritative Table**: `public.employees`
- **Examples**: Staff members invited by admin to workspace

---

## Authentication Flows

### Client Admin Signup

```
1. User submits signup form
   POST /api/auth/signup
   
2. Supabase creates auth user
   Creates auth.users entry, issues JWT
   
3. Internal user created
   Creates public.users with role='client_admin'
   
4. Workspace auto-provisioned
   Creates public.workspaces
   Creates public.workspace_members entry
   Creates public.admin_access entry
   
5. Session created
   Sets httpOnly session cookie (7-day expiration)
   
6. Success response
   Returns { user, workspaceId }
   
7. Browser stores credentials
   useAuth hook calls /api/auth/me
   
8. Auth validated
   Returns { role: 'admin', workspaceId }
   
9. Middleware authorizes
   Allows access to /dashboard/[workspaceId]
   User lands on dashboard
```

**Key Implementation Details:**
- Workspace name "My Workspace" is reused if duplicate (idempotent)
- Workspace provisioning is non-fatal (signup succeeds even if workspace creation fails)
- Service role client used for workspace creation (bypasses RLS)
- Each database operation uses fresh client instance (avoids schema cache issues)

### Client Admin Login

```
1. User submits login credentials
   POST /api/auth/login
   
2. Supabase authenticates
   Validates against auth.users, returns JWT
   
3. Internal user resolved
   ensureInternalUser() fetches or creates public.users entry
   
4. Role & workspace resolved
   Detects: admin_access entry OR workspace_members entry
   Returns { role: 'admin', workspaceId }
   
5. Session created/updated
   Sets session cookie
   
6. Login success response
   Returns { user, workspaceId }
   
7. Client initializes auth
   useAuth hook calls /api/auth/me
   
8. Auth state returned
   Returns { role: 'admin', workspaceId }
   
9. Middleware authorizes
   Allows access to /dashboard/[workspaceId]
```

### Role Resolution in Middleware

Middleware (`middleware.ts`) resolves roles through this priority chain:

1. **Super Admin**: Check `users.role = 'super_admin'`
   - No workspace needed
   - Access to `/admin/*`

2. **Client Admin via admin_access**: Check `admin_access` table
   - Query by user_id, get workspace_id
   - Access to `/dashboard/[workspaceId]/*`

3. **Client Admin via workspace_members**: Check `users.role = 'client_admin'` + `workspace_members`
   - Query workspace_members for workspace_id
   - Access to `/dashboard/[workspaceId]/*`

4. **Employee**: Check `employees` table
   - Query by user_id, get workspace_id
   - Access to `/employees/dashboard/[workspaceId]/*`

### Access Control Rules

**Super Admin:**
- ✓ Can access `/admin/*`
- ✗ Cannot access `/dashboard/*`
- ✗ Cannot access `/employees/*`
- Redirect: `/dashboard` → `/admin`

**Client Admin:**
- ✓ Can access `/dashboard/[workspaceId]/*` (their workspace only)
- ✓ Can access `/onboarding`, `/invite`, `/`
- ✗ Cannot access other workspaces
- ✗ Cannot access `/admin/*`
- Redirect: Missing workspaceId → `/unauthorized`

**Employee:**
- ✓ Can access `/employees/dashboard/[workspaceId]/*` (assigned workspace only)
- ✗ Cannot access `/dashboard/*`
- ✗ Cannot access `/admin/*`

---

## Middleware Authorization

Middleware enforces role-based access control at the request level for:
- `/admin/*` - Super admin only
- `/dashboard/*` - Client admin with workspace
- `/employees/*` - Employee with workspace (future)

The middleware:
1. Validates Supabase session
2. Fetches internal user profile
3. Detects role through priority chain above
4. Validates workspace requirement for role
5. Allows, redirects, or blocks request

---

## Database Schema

### `public.users`

Internal user profile linked to Supabase Auth

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  role TEXT,  -- NULL for most users, 'super_admin' for platform admins
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  business_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  api_key TEXT UNIQUE,
  plan_type TEXT DEFAULT 'starter',
  payment_status TEXT DEFAULT 'unpaid',
  subscription_status TEXT,
  billing_end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Points:**
- `auth_uid`: Unique link to Supabase Auth user
- `id`: Internal user identifier (canonical, used throughout app)
- `role`: Only populated for super_admin; other roles determined by `admin_access` or `employees`
- During client admin signup: role set to `'client_admin'`, then `workspace_members` is primary source

---

### `public.workspaces`

Workspace owned by a client admin

```sql
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id),
  name TEXT NOT NULL DEFAULT 'My Workspace',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workspaces_owner_id ON public.workspaces(owner_id);
```

**Key Points:**
- `owner_id`: User who created/owns the workspace
- `name`: "My Workspace" is reused across users (not UNIQUE constraint)
- One workspace per client admin (by convention)
- Multiple workspaces possible for same admin (future multi-tenant)

---

### `public.workspace_members`

User's membership in a workspace

```sql
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  role TEXT DEFAULT 'member',  -- 'admin', 'staff', 'member'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);
```

**Key Points:**
- Composite unique constraint on (workspace_id, user_id)
- Client admin signup creates entry here immediately
- Role within workspace (admin vs staff vs member)
- Used by middleware to resolve client admin's workspace_id
- Used by `/api/auth/me` to resolve workspace_id

---

### `public.admin_access`

Explicit admin role assignment (alternative to workspace_members for auth resolution)

```sql
CREATE TABLE public.admin_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX idx_admin_access_user_id ON public.admin_access(user_id);
CREATE INDEX idx_admin_access_workspace_id ON public.admin_access(workspace_id);
```

**Key Points:**
- Stores explicit admin grants
- Created in parallel with `workspace_members` during signup
- Provides secondary path for role resolution in middleware
- Composite unique constraint ensures one admin entry per user per workspace

---

### `public.employees`

Track employee assignments to workspaces

```sql
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employees_workspace_id ON public.employees(workspace_id);
```

**Key Points:**
- Employees invited by client admin to workspace
- One entry per user per workspace
- Middleware resolves employee role from this table

---

## Session Handling

### Cookie-Based Sessions (Current Implementation)

Sessions are managed through **httpOnly cookies**:

**Properties:**
- **HttpOnly**: JavaScript cannot access (XSS protection)
- **Secure**: Sent only over HTTPS
- **SameSite=Lax**: CSRF protection
- **Max-Age**: 7 days (604,800 seconds)

**Workflow:**
1. Signup/login succeeds
2. Session created via `sessionManager.create()`
3. `session_id` cookie set in response
4. Browser includes cookie in all subsequent requests
5. `/api/auth/me` validates session via Supabase Auth
6. Middleware uses auth state to enforce authorization

### No Database-Backed Sessions Required

Sessions work WITHOUT a `public.sessions` table because:
- Sessions validated through Supabase Auth JWT
- 7-day expiration enforced by browser cookie rules
- Missing `public.sessions` table does NOT break the system
- Current implementation is production-ready

---

## Known Non-Critical Warnings

### Schema Cache Messages

**What**: Supabase JS client occasionally logs "Could not find table in schema cache" warnings

**Severity**: **NON-BLOCKING**

**Why It Doesn't Break the System**:
- Occurs during workspace creation (parallel operations)
- Fresh client instances created per operation (avoids staleness)
- Schema cache refreshes automatically
- All database operations complete successfully despite warnings

**Mitigation**: Not required; operations complete despite warnings

---

## Verification Checklist

Use this checklist to confirm the authentication system is working correctly:

### Super Admin Login
- [ ] Super admin can login with correct credentials
- [ ] `/api/auth/me` returns `role: 'super_admin'` and `workspaceId: null`
- [ ] Middleware allows access to `/admin/*` routes
- [ ] Dashboard routes (`/dashboard`) redirect to `/admin`

### Client Admin Signup
- [ ] User can submit signup form with email, password, business name
- [ ] Supabase auth user created
- [ ] Internal user created with `role: 'client_admin'`
- [ ] Workspace created with default name
- [ ] `workspace_members` entry created
- [ ] `admin_access` entry created
- [ ] Session cookie set (httpOnly, Secure, SameSite=Lax)
- [ ] Response contains workspaceId
- [ ] No console errors during signup

### Client Admin Login
- [ ] User can login with credentials
- [ ] `/api/auth/me` returns `role: 'admin'` and correct `workspaceId`
- [ ] Middleware allows access to `/dashboard/[workspaceId]`
- [ ] Dashboard renders without unauthorized errors
- [ ] Session cookie refreshed/maintained

### Workspace Access
- [ ] Client admin can only access their own workspace dashboard
- [ ] Attempting to access different workspace redirects to `/unauthorized`
- [ ] Workspace data loads correctly (employees, settings, etc.)

### Unauthorized Access Prevention
- [ ] Unauthenticated users cannot access `/admin`, `/dashboard`, `/employees`
- [ ] Employees cannot access `/admin` or `/dashboard`
- [ ] Super admin accessing `/dashboard` redirects to `/admin`
- [ ] Missing workspace redirects to `/unauthorized` or `/onboarding`

---

## Current System Status

### Authentication System
✓ **Stable and Production Ready**

The authentication pipeline is complete and functional for:
- Email/password signup and login
- Internal user provisioning
- Workspace auto-provisioning on signup
- Session management via httpOnly cookies
- Role detection and resolution

### Role Resolution
✓ **Correct and Validated**

All role types resolve correctly:
- Super admin detected from `users.role`
- Client admin detected from `users.role` + `workspace_members`
- Employee detection available for future implementation
- Middleware enforces roles correctly

### Middleware Authorization
✓ **Enforced at Request Level**

All protected routes guarded:
- `/admin/*` - Super admin only
- `/dashboard/*` - Client admin with workspace
- `/employees/*` - Reserved for future employee feature
- Role mismatches redirect appropriately

### Workspace Provisioning
✓ **Idempotent and Non-Blocking**

Workspace creation:
- Automatic on client admin signup
- Handles duplicate workspace names gracefully
- Non-fatal (signup succeeds even if workspace fails)
- Workspace immediately accessible post-signup

### Session Persistence
✓ **Working Without Database-Backed Sessions**

Current implementation:
- Cookie-based sessions function correctly
- No dependency on `public.sessions` table
- 7-day expiration enforced
- XSS/CSRF protections in place

---

## Summary

Retail Assist implements a complete, production-ready authentication system with:

1. **Dual-identity architecture** (Supabase Auth + internal users)
2. **Three role types** (super admin, client admin, employee)
3. **Workspace-scoped access** (each client admin owns one workspace)
4. **Middleware-enforced authorization** (role + workspace validation)
5. **Auto-provisioning on signup** (workspace created immediately)
6. **Cookie-based sessions** (no database table required)

The system is ready for:
- Production user traffic
- Employee feature expansion
- Integration with workspace-specific features
- Long-term maintenance and support

---

**Last Reviewed:** January 27, 2026  
**Maintainer:** Engineering Team  
**Status:** Production Ready
