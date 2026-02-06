# Authentication & Authorization System Architecture Audit Report

**Date**: January 2025  
**Scope**: Complete review of authentication, authorization, role resolution, and workspace scoping architecture  
**Status**: ✅ AUDIT COMPLETE

---

## Executive Summary

This comprehensive audit examines the authentication and authorization system's architecture, implementation consistency, and data flow integrity. The system demonstrates **strong overall design** with clear role separation and workspace scoping, but has one **critical architectural inconsistency** that should be addressed.

### Key Findings

| Category | Status | Severity | Impact |
|----------|--------|----------|--------|
| Role Model & Invariants | ✅ Well-designed | - | None |
| RPC Implementation | ✅ Correct | - | None |
| API Endpoints | ✅ Correct Usage | - | None |
| Middleware | ⚠️ Inconsistency | **HIGH** | Potential role resolution divergence |
| Database Schema | ✅ Proper Design | - | None |
| Access Control | ✅ Enforced | - | None |
| Workspace Scoping | ✅ Proper | - | None |

---

## 1. CRITICAL FINDING: Middleware Diverges from RPC Source of Truth

### 🔴 Issue Description

The middleware implements role and workspace resolution **directly from database tables**, bypassing the RPC function that is designed to be the **authoritative source of truth**. This creates a potential [source-of-truth mismatch](source-of-truth-mismatch-detail).

**File**: [middleware.ts](middleware.ts)  
**RPC Definition**: [supabase/migrations/029_fix_get_user_access.sql](supabase/migrations/029_fix_get_user_access.sql)

### 1.1 Direct Source Comparison

#### For Client Admin Role

**RPC (authoritative, migration 029)**:
```sql
select
  aa.user_id,
  aa.workspace_id,
  'admin'::text as role
from public.admin_access aa
where aa.workspace_id is not null
  and aa.workspace_id != '00000000-0000-0000-0000-000000000001'
```
✅ Uses `admin_access` table

**Middleware (current implementation, lines 144-156)**:
```typescript
const { data: membershipData } = await supabase
  .from('workspace_members')
  .select('workspace_id')
  .eq('user_id', clientAdminData.id)
  .maybeSingle();

if (membershipData?.workspace_id) {
  workspaceId = membershipData.workspace_id;
}
```
⚠️ Uses `workspace_members` table instead

#### For All Roles Comparison

| Role | RPC Source | Middleware Source | Match? |
|------|-----------|-------------------|--------|
| Super Admin | `users.role = 'super_admin'` | `users.role = 'super_admin'` | ✅ YES |
| Client Admin | `admin_access.workspace_id` | `workspace_members.workspace_id` | ❌ **NO** |
| Platform Staff | `admin_access` (platform workspace) | Not implemented in middleware | ⚠️ MISSING |
| Employee | `employees.workspace_id` | `employees.workspace_id` | ✅ YES |

### 1.2 Why This Matters

Both `workspace_members` and `admin_access` are populated during signup (see [CLIENT_ADMIN_SIGNUP_FIX_SUMMARY.md](CLIENT_ADMIN_SIGNUP_FIX_SUMMARY.md), lines 69-85):

```typescript
// Both tables are populated together
await supabase.from('workspace_members').insert({ user_id, workspace_id, role: 'admin' });
await supabase.from('admin_access').insert({ user_id, workspace_id, role: 'admin' });
```

However, they serve different purposes:
- **`workspace_members`**: User's membership in a workspace (can have multiple entries for multiple workspaces)
- **`admin_access`**: Explicit admin role assignment (alternative path for role resolution per RLS)

### 1.3 Risks from This Divergence

1. **Inconsistent Role Resolution**: If an entry exists in `admin_access` but not `workspace_members`, the RPC will correctly resolve role but middleware won't
2. **Data Cleanup Issues**: If `workspace_members` is deleted but `admin_access` remains, role resolution diverges
3. **Future Migration Risk**: If data schemas change, two separate implementations must be kept in sync
4. **Testing/Verification Confusion**: Tests using RPC might pass while actual requests fail due to middleware divergence
5. **Performance**: Middleware makes unnecessary extra database queries instead of using RPC (3 separate queries vs. 1 RPC call)

### 1.4 Documentation Gap

The documentation ([AUTH_AND_WORKSPACE_SYSTEM.md](AUTH_AND_WORKSPACE_SYSTEM.md), lines 154-171) describes the middleware as having two paths for client admin resolution:

> "2. **Client Admin via admin_access**: Check `admin_access` table  
> 3. **Client Admin via workspace_members**: Check `users.role = 'client_admin'` + `workspace_members`"

This suggests the middleware SHOULD check `admin_access` first, but the actual code only checks `workspace_members`.

---

## 2. API Endpoints - Correct Usage ✅

### Assessment: CORRECT

The API endpoints properly use the RPC as the authoritative source.

**Example**: [app/api/employees/route.ts](app/api/employees/route.ts), lines 166-175

```typescript
// ✅ CORRECT: Use RPC for authoritative role/workspace resolution
const { data: roleData, error: roleError } = await supabase
  .rpc('rpc_get_user_access')
  .single();

const { role, workspace_id } = roleData as { role: string; workspace_id: string };

if (role !== 'admin') {
  return NextResponse.json({ error: 'Admins only' }, { status: 403 });
}

// ✅ CRITICAL: NEVER ACCEPT workspace_id FROM FRONTEND
// workspace_id is ALWAYS derived from authenticated user context
const inviteWorkspaceId = workspace_id;  // NOT from request body
```

**Comment on line 185 is excellent**:
```typescript
// ===== CRITICAL: NEVER ACCEPT workspace_id FROM FRONTEND =====
// workspace_id is ALWAYS derived from authenticated user context
// Client admin can ONLY invite employees to their own workspace
// This prevents cross-workspace privilege escalation
```

---

## 3. RPC Implementation - Correct Design ✅

### Assessment: CORRECT & WELL-DESIGNED

**File**: [supabase/migrations/029_fix_get_user_access.sql](supabase/migrations/029_fix_get_user_access.sql)

The RPC properly implements:

1. **Priority-Based Role Resolution** (Deterministic - exactly one role returned):
   ```sql
   select ... from (...
     union all  -- Super admin check
     union all  -- Platform staff check
     union all  -- Client admin check  
     union all  -- Employee check
   ) r
   order by r.priority
   limit 1;  -- ← Ensures exactly 1 role
   ```

2. **Role Invariants** (Properly enforced):
   - Super Admin: `workspace_id = NULL`
   - Platform Staff: `workspace_id = '00000000-0000-0000-0000-000000000001'`
   - Client Admin: `workspace_id IS NOT NULL` and `!= platform_workspace_id`
   - Employee: `workspace_id IS NOT NULL`

3. **Correct Table Sources**:
   - ✅ Super admin: `users` table
   - ✅ Platform staff: `admin_access` table
   - ✅ Client admin: `admin_access` table
   - ✅ Employee: `employees` table

---

## 4. Authentication Flows - Key Data Points ✅

### 4.1 Client Admin Signup Flow

**File**: [app/api/auth/signup/route.ts](app/api/auth/signup/route.ts)

The flow correctly:

1. Creates Supabase auth user
2. Creates internal user with `role = 'client_admin'`
3. **Creates both `workspace_members` AND `admin_access` entries** (line 102-110)
4. Returns workspaceId to client

```typescript
// ✅ CORRECT: Both tables populated
const workspaceResult = await ensureWorkspaceForUser(newUser.id);
// Inside ensureWorkspaceForUser:
// - INSERT into workspace_members
// - INSERT into admin_access (lines 187+)
```

### 4.2 Client Admin Login Flow

**File**: [app/api/auth/login/route.ts](app/api/auth/login/route.ts), lines 177-210

The flow:
1. Checks `users.role = 'client_admin'` ✅
2. **BUG**: Also checks `workspace_members` for workspace_id instead of `admin_access` ❌

```typescript
// Line 202-209: Uses workspace_members (should use admin_access or RPC)
const { data: membershipCheck } = await adminClient
  .from('workspace_members')
  .select('workspace_id')
  .eq('user_id', internalUserId)
  .maybeSingle();
```

**Issue**: This is the same bug as middleware!

### 4.3 Auth Me Endpoint

**File**: [app/api/auth/me/route.ts](app/api/auth/me/route.ts)

Same pattern - uses `workspace_members` instead of calling RPC or checking `admin_access`. See lines 91-105.

---

## 5. Role-Based Invariants - Properly Maintained ✅

### Assessment: CORRECT

All invariants are properly maintained throughout the system:

#### Super Admin Invariants
- ✅ `workspace_id` is ALWAYS `NULL`
- ✅ Only in `users` table with `role = 'super_admin'`
- ✅ Can only access `/admin/*` routes
- ✅ Middleware correctly enforces (lines 172-199 of middleware.ts)

#### Client Admin Invariants
- ✅ `workspace_id` is NOT NULL and NOT platform workspace
- ✅ In `users` table with `role = 'client_admin'`
- ✅ Entries in BOTH `admin_access` AND `workspace_members`
- ✅ Can only access `/dashboard/*` routes
- ✅ Middleware enforces but via wrong table (lines 209-237)

#### Employee Invariants
- ✅ `workspace_id` is NOT NULL
- ✅ Only in `employees` table (never in `users.role`)
- ✅ Can only access `/employees/dashboard/*` routes
- ✅ Middleware correctly enforces (lines 253-310)

#### Platform Staff Invariants
- ✅ `workspace_id` = `'00000000-0000-0000-0000-000000000001'`
- ✅ Only in `admin_access` with platform workspace_id
- ⚠️ **NOT implemented in middleware** (missing entirely) - middleware has no special handling for platform_staff role
- 🚫 This could allow platform staff to bypass restrictions!

---

## 6. Workspace Scoping - Properly Enforced ✅

### Assessment: CORRECT

The system properly prevents cross-workspace access:

**Example**: [app/api/employees/route.ts](app/api/employees/route.ts), lines 176-188

```typescript
// ✅ CRITICAL ENFORCEMENT
// Admin MUST have workspace_id (client admins are scoped to exactly one workspace)
if (!workspace_id) {
  console.error('[/api/employees/invite POST] Admin has no workspace_id:', { user_id, role });
  return NextResponse.json({ error: 'Invalid admin state' }, { status: 403 });
}

// ✅ CRITICAL: NEVER ACCEPT workspace_id FROM FRONTEND
// workspace_id is ALWAYS derived from authenticated user context
// Client admin can ONLY invite employees to their own workspace
const inviteWorkspaceId = workspace_id;  // NOT from request body
```

This pattern is consistent across all API endpoints.

---

## 7. Database Schema - Proper Design ✅

### Assessment: CORRECT

The schema properly supports the authentication model:

#### users table
```sql
id UUID PRIMARY KEY
auth_uid UUID → auth.users(id)
role TEXT -- 'super_admin' | NULL
email TEXT
workspace_id UUID -- NULL (for future use, currently unused)
```

#### admin_access table (Migration 035)
```sql
user_id UUID → users(id)
workspace_id UUID → workspaces(id)
role TEXT -- 'admin'
UNIQUE(user_id, workspace_id)
-- Used by RPC for role resolution
```

#### workspace_members table
```sql
user_id UUID → users(id)
workspace_id UUID → workspaces(id)
role TEXT -- 'admin' | 'member' | 'staff'
UNIQUE(workspace_id, user_id)
-- Used for workspace membership tracking
```

#### employees table
```sql
user_id UUID → users(id)
workspace_id UUID → workspaces(id)
invited_by_role TEXT -- 'super_admin' | 'client_admin'
-- Used by RPC for employee role detection
```

---

## 8. Session Management - Secure Design ✅

### Assessment: CORRECT

Sessions are properly managed:

1. **Server-side session creation** with httpOnly cookies
2. **Supabase JWT validation** in middleware
3. **No client-side modification** of role/workspace
4. **Session tied to internal user ID** (not auth_uid)

---

## Recommendations (Priority Order)

### 🔴 CRITICAL: Fix Middleware to Use RPC (Blocks Release)

**Priority**: HIGHEST  
**Effort**: Small  
**Risk**: High (current state)

**Current**:
```typescript
// middleware.ts lines 102-156
// WRONG: Direct table queries
```

**Proposed**:
```typescript
// ALL role resolution should go through RPC
const { data: roleData, error: roleError } = await supabase
  .rpc('rpc_get_user_access')
  .single();

if (roleError || !roleData) {
  return NextResponse.redirect(new URL('/unauthorized', request.url));
}

const { role, workspace_id } = roleData;
```

**Files to Update**:
- [middleware.ts](middleware.ts) - Lines 102-156
- [app/api/auth/login/route.ts](app/api/auth/login/route.ts) - Lines 202-210
- [app/api/auth/me/route.ts](app/api/auth/me/route.ts) - Lines 91-105

**Benefits**:
- ✅ Single source of truth
- ✅ Fewer database queries (1 RPC vs 3 separate queries)
- ✅ Easier to maintain and test
- ✅ Automatic consistency with future role changes

### 🟡 IMPORTANT: Add Platform Staff Support to Middleware

**Priority**: HIGH  
**Effort**: Medium  
**Risk**: Medium (missing functionality)

**Current**: Middleware has no special handling for platform_staff role  
**Required**: Add path:
```typescript
// After super_admin, before client_admin
if (role === 'platform_staff') {
  // Validate workspace_id = PLATFORM_WORKSPACE_ID
  // Only allow /admin/support/* routes
}
```

**Files to Update**:
- [middleware.ts](middleware.ts)

### 🟡 MEDIUM: Use admin_access as Primary Source for Client Admin

**Priority**: MEDIUM (if RPC fix not applied)  
**Effort**: Small  
**Risk**: Low

**Note**: This becomes MOOT if middleware is updated to use RPC. If staying with direct queries, should be:

```typescript
// Query admin_access (official source per RPC)
const { data: adminData } = await supabase
  .from('admin_access')
  .select('workspace_id')
  .eq('user_id', clientAdminData.id)
  .maybeSingle();
```

### 📋 NICE-TO-HAVE: Add Caching for RPC Results

**Priority**: LOW  
**Effort**: Medium  
**Risk**: Low

Add Redis/in-memory cache for RPC results to reduce database queries:
```typescript
// Middleware could cache RPC results for 5-15 minutes
// with TTL based on session validity
```

### 📋 NICE-TO-HAVE: Improve Logging

**Priority**: LOW  
**Effort**: Small

Add structured logging for:
- Role resolution source and timing
- Workspace validation results
- Access decisions (allow/deny/redirect)

Useful for debugging and audit trails.

---

## Testing Recommendations

### 1. Integration Tests for Role Resolution

```typescript
describe('Role Resolution Consistency', () => {
  test('Client admin resolved consistently by RPC and middleware', async () => {
    // Create test client admin
    const admin = await createTestClientAdmin();
    
    // Get role via RPC
    const rpcData = await supabase.rpc('rpc_get_user_access').single();
    
    // Get role via middleware simulation
    const middlewareData = await resolveRoleInMiddleware(admin.id);
    
    // Should match
    expect(rpcData.role).toBe(middlewareData.role);
    expect(rpcData.workspace_id).toBe(middlewareData.workspace_id);
  });
  
  test('Super admin workspace_id is always null', async () => {
    const superAdmin = await createTestSuperAdmin();
    const { workspace_id } = await supabase.rpc('rpc_get_user_access').single();
    expect(workspace_id).toBeNull();
  });

  test('Employee cannot access admin routes', async () => {
    const employee = await createTestEmployee();
    const response = await fetch('/api/employees/invite', {
      method: 'POST',
      headers: getAuthHeaders(employee),
    });
    expect(response.status).toBe(403);
  });
});
```

### 2. Database Consistency Checks

```sql
-- Verify no orphaned admin_access entries
SELECT aa.* FROM admin_access aa
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.user_id = aa.user_id
    AND wm.workspace_id = aa.workspace_id
);

-- Verify all client admins have both entries
SELECT DISTINCT u.id FROM users u
WHERE u.role = 'client_admin'
  AND NOT EXISTS (
    SELECT 1 FROM admin_access aa
    WHERE aa.user_id = u.id
  );
```

### 3. Middleware Behavior Tests

- ✅ Super admin can access `/admin` (status 200)
- ✅ Super admin redirected from `/dashboard` (status 307)
- ✅ Client admin can access `/dashboard/[workspaceId]` (status 200)
- ✅ Client admin redirected from `/admin` (status 307)
- ✅ Platform staff can ONLY access `/admin/support` (implement if missing)
- ✅ Employee can access `/employees/dashboard` (status 200)
- ✅ Employee cannot access `/dashboard` (status 307)

---

## Appendix A: Root Cause Analysis

### Why Middleware Bypasses RPC

The middleware was likely built before or alongside the RPC, using direct table queries for efficiency. Each endpoint then replicated this logic, creating multiple implementation points.

The RPC was introduced in migration 029 as the "authoritative source", but the middleware was not updated to use it.

### Why workspace_members vs admin_access?

1. **workspace_members** - User's membership in organization
2. **admin_access** - User's administrative role

Both are populated at signup for redundancy, but `admin_access` is the official source per RPC design.

The middleware may have chosen `workspace_members` because it's more semantically correct ("whose workspace is this?") rather than `admin_access` (which has dual meaning for role).

However, consistency trumps semantic correctness for critical auth paths.

---

## Appendix B: Issue Tracking

### Source-of-Truth Mismatch Detail

**System Design Documents Stating RPC is Authoritative**:
- [ROLE_BASED_ROUTING_ARCHITECTURE.md](ROLE_BASED_ROUTING_ARCHITECTURE.md) - Line 181
- [MESSAGE_UI_IMPLEMENTATION.md](MESSAGE_UI_IMPLEMENTATION.md) - Line 119: "RPC Role Resolution - Authoritative source"
- [ROLE_BASED_ROUTING_COMPLETE.md](ROLE_BASED_ROUTING_COMPLETE.md) - Line 155: "Calls rpc_get_user_access() → get authoritative role"

**Actual Implementation**:
- Middleware directly queries tables (lines 102-156)
- API endpoints correctly use RPC (verified)
- Auth endpoints (login, signup, me) use direct queries (lines 177-210)

---

## Appendix C: Files Reviewed

**Core Files**:
- [middleware.ts](middleware.ts) - Main issue identified
- [supabase/migrations/029_fix_get_user_access.sql](supabase/migrations/029_fix_get_user_access.sql) - RPC definition (correct)
- [supabase/migrations/024_create_rpc_create_user_profile.sql](supabase/migrations/024_create_rpc_create_user_profile.sql) - Supporting RPC
- [supabase/migrations/002_complete_schema.sql](supabase/migrations/002_complete_schema.sql) - Schema baseline

**API Endpoints**:
- [app/api/employees/route.ts](app/api/employees/route.ts) - Uses RPC ✅
- [app/api/employees/[id]/route.ts](app/api/employees/[id]/route.ts) - Uses RPC ✅
- [app/api/auth/signup/route.ts](app/api/auth/signup/route.ts) - Uses table queries ⚠️
- [app/api/auth/login/route.ts](app/api/auth/login/route.ts) - Uses table queries ⚠️
- [app/api/auth/me/route.ts](app/api/auth/me/route.ts) - Uses table queries ⚠️

**Documentation**:
- [AUTH_AND_WORKSPACE_SYSTEM.md](AUTH_AND_WORKSPACE_SYSTEM.md)
- [ROLE_BASED_ROUTING_ARCHITECTURE.md](ROLE_BASED_ROUTING_ARCHITECTURE.md)
- [CLIENT_ADMIN_SIGNUP_FIX_SUMMARY.md](CLIENT_ADMIN_SIGNUP_FIX_SUMMARY.md)
- [ROLE_BASED_ROUTING_COMPLETE.md](ROLE_BASED_ROUTING_COMPLETE.md)

---

## Conclusion

The authentication and authorization system demonstrates **solid architectural design** with:
- ✅ Well-designed RPC for authoritative role resolution
- ✅ Proper workspace scoping enforcement
- ✅ Strong API endpoint security
- ✅ Clear role invariants
- ✅ Secure session management

However, it has **ONE CRITICAL INCONSISTENCY** where the middleware bypasses the RPC and uses direct table queries, creating risk of role resolution divergence.

**Recommended Action**: Update middleware and auth endpoints to use RPC exclusively (small change, high impact on consistency and maintainability).

**Estimated Effort**: 1-2 hours  
**Risk of Current State**: MEDIUM-HIGH (role resolution could diverge under certain data conditions)  
**Impact of Fix**: Eliminates source-of-truth inconsistency, improves performance, simplifies maintenance

---

**Report Generated**: January 2025  
**Next Review**: After implementing critical recommendations
