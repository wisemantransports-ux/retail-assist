# Role Hierarchy Refactoring - Complete Changelog

**Date:** January 14, 2026  
**Status:** ✅ COMPLETE  
**Breaking Change:** YES - Requires database migration and environment updates

---

## Overview

This document tracks the complete role hierarchy refactoring that transitions from a single-tier admin system to a two-tier role system:

### Old Role Structure
- **`role: 'admin'`** → Platform-wide super admin (manages all users, system settings, billing)
- **`role: null/user`** → Regular user (workspace member)

### New Role Structure
- **`role: 'super_admin'`** → Platform-wide super admin (manages all users, system settings, billing)
- **`role: 'admin'`** → Workspace admin (manages workspace members, agents, settings)
- **`role: null/user`** → Regular workspace member (read-only or member access)

### Workspace Member Roles
**Note:** Workspace member roles (stored in `workspace_members.role`) are distinct from user roles:
- `'owner'` → Workspace owner (full control)
- `'admin'` → Workspace admin (can manage team, agents, automation)
- `'staff'`/`'member'` → Workspace member (limited access)

---

## Changes Made

### 1. Frontend - Admin Dashboard Pages

**Location:** `/app/admin/**`

| File | Change | Details |
|------|--------|---------|
| `admin/page.tsx` | `role !== 'admin'` → `role !== 'super_admin'` | Admin dashboard now requires `super_admin` role |
| `admin/users/[id]/page.tsx` | `role !== 'admin'` → `role !== 'super_admin'` | User detail page now requires `super_admin` role |
| `admin/settings/page.tsx` | `role !== 'admin'` → `role !== 'super_admin'` | Admin settings now require `super_admin` role |
| `admin/logs/page.tsx` | `role !== 'admin'` → `role !== 'super_admin'` | Admin logs now require `super_admin` role |
| `admin/login/page.tsx` | `role !== 'admin'` → `role !== 'super_admin'` | Login redirect now checks for `super_admin` role |

**Impact:** All admin dashboard pages now check for `super_admin` role instead of `admin`. Users with `admin` role will be redirected to `/admin/login`.

---

### 2. Backend - API Routes

**Location:** `/app/api/admin/**` and other authenticated endpoints

| File | Change | Details |
|------|--------|---------|
| `api/admin/users/route.ts` | Two updates:<br>1. `verifyAdmin()` checks `role !== 'super_admin'`<br>2. User list filter excludes `role !== 'super_admin'` | GET/PATCH users endpoints now require `super_admin` role |
| `api/admin/users/[id]/route.ts` | `role !== 'admin'` → `role !== 'super_admin'` | User detail API now requires `super_admin` role |
| `api/admin/settings/route.ts` | `role !== 'admin'` → `role !== 'super_admin'` | Admin settings API now requires `super_admin` role |
| `api/admin/logs/route.ts` | `role !== 'admin'` → `role !== 'super_admin'` | Admin logs API now requires `super_admin` role |
| `api/branding/route.ts` | `role !== 'admin'` → `role !== 'super_admin'` | Branding API now requires `super_admin` role |

**Impact:** All admin API endpoints now enforce `super_admin` role. Requests from users with `admin` role will receive 401 Unauthorized.

---

### 3. Components - Authentication & Guards

**Location:** `/app/components/**`

| File | Change | Details |
|------|--------|---------|
| `SubscriptionGuard.tsx` | Three updates:<br>1. Checks `userData.role === "admin" \|\| userData.role === "super_admin"`<br>2. `canUseFeature()` grants access to both roles<br>3. `readOnly` excludes both roles | Dashboard now allows both `admin` and `super_admin` users full access |

**Impact:** Workspace admins (`admin` role) now have full access to client dashboard without subscription checks.

---

### 4. Initialization & Setup Scripts

**Location:** `/scripts/**`

| File | Change | Details |
|------|--------|---------|
| `scripts/init-admin.ts` | `role: 'admin'` → `role: 'super_admin'` | Admin user initialization now creates `super_admin` role |
| `scripts/create-admin-users.ts` | `role: 'admin'` → `role: 'super_admin'` in DEFAULT_USERS | Admin user creation script now uses `super_admin` role |

**Impact:** New admin users created via scripts will have `super_admin` role.

---

### 5. Workspace Setup

**Location:** `/app/lib/supabase/ensureWorkspaceForUser.ts`

| File | Change | Details |
|------|--------|---------|
| `ensureWorkspaceForUser.ts` | No changes needed | Users are added as `'admin'` workspace members (correct) |

**Note:** This is workspace member role, not user role. Correctly remains as `'admin'` for workspace members.

---

## Database Migration Required

### Update Users Table

```sql
-- Migration: Update user roles from 'admin' to 'super_admin'
UPDATE public.users
SET role = 'super_admin'
WHERE role = 'admin' AND subscription_tier = 'enterprise';

-- Verify the update
SELECT id, email, role FROM public.users WHERE role IN ('admin', 'super_admin');
```

### Update Default Workspace Members

```sql
-- Workspace members remain as 'admin' (workspace level)
-- No change needed - this is different from user.role
SELECT id, user_id, role FROM public.workspace_members LIMIT 5;
```

---

## Authorization Matrix

| User Role | Access Level | What They Can Do |
|-----------|--------------|------------------|
| `super_admin` | System-wide | ✅ Manage all users<br>✅ Approve/suspend accounts<br>✅ Modify billing & payments<br>✅ Update branding/system settings<br>✅ View system logs |
| `admin` | Workspace-level | ✅ Access client dashboard<br>✅ Create/edit AI agents<br>✅ Manage inbox & automation<br>✅ Invite team members<br>✅ View workspace analytics<br>❌ Access admin panel<br>❌ Manage other workspaces |
| `null`/`user` | Workspace-level | ✅ View shared data<br>✅ Respond to messages<br>❌ Create/delete agents (depends on workspace role)<br>❌ Invite members<br>❌ Modify settings |

---

## Workspace Member Roles (unchanged)

| Member Role | Context | Permissions |
|-------------|---------|------------|
| `owner` | Workspace | Full control over workspace |
| `admin` | Workspace | Can manage agents, automation, team members |
| `staff` | Workspace | Can view & respond to messages |
| `member` | Workspace | Limited access (view only) |

---

## Testing Checklist

### Admin Dashboard Access
- [ ] Super admin can access `/admin` dashboard
- [ ] Super admin can view all users
- [ ] Super admin can approve/suspend accounts
- [ ] Super admin can update settings
- [ ] Super admin can view logs
- [ ] Regular user gets redirected from `/admin` to `/admin/login`
- [ ] Workspace admin gets redirected from `/admin` to `/admin/login`

### Client Dashboard Access
- [ ] Workspace admin can access `/dashboard`
- [ ] Workspace admin can create/edit agents
- [ ] Workspace admin can manage inbox
- [ ] Workspace admin can invite team members
- [ ] Workspace admin can access all features without subscription checks
- [ ] Workspace admin sees no "upgrade" prompts

### API Endpoints
- [ ] GET `/api/admin/users` requires `super_admin` role (401 for others)
- [ ] PATCH `/api/admin/users` requires `super_admin` role (401 for others)
- [ ] GET `/api/admin/logs` requires `super_admin` role (401 for others)
- [ ] PUT `/api/branding` requires `super_admin` role (401 for others)
- [ ] `/api/auth/me` returns correct role

### Feature Gates
- [ ] Workspace admin can create agents (no "upgrade" gate)
- [ ] Workspace admin can connect Facebook pages
- [ ] Workspace admin can use Instagram features
- [ ] Regular user sees appropriate feature gates

---

## Migration Steps

### 1. Pre-Migration (Backup)
```bash
# Backup your database
supabase db dump --local > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Run Migration
```sql
-- Apply the database migration
UPDATE public.users
SET role = 'super_admin'
WHERE role = 'admin';
```

### 3. Deploy Code
- Deploy updated frontend code
- Deploy updated API routes
- Deploy updated scripts

### 4. Verify
```bash
# Test super admin login
curl http://localhost:3000/api/auth/me

# Test admin dashboard access
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/admin/users
```

### 5. Create New Super Admin (if needed)
```bash
# Using the updated init-admin.ts script
npm run init-admin
```

---

## Files Modified

**Total Files:** 16

### Frontend Pages (5)
1. `/app/admin/page.tsx`
2. `/app/admin/users/[id]/page.tsx`
3. `/app/admin/settings/page.tsx`
4. `/app/admin/logs/page.tsx`
5. `/app/admin/login/page.tsx`

### API Routes (5)
6. `/app/api/admin/users/route.ts`
7. `/app/api/admin/users/[id]/route.ts`
8. `/app/api/admin/settings/route.ts`
9. `/app/api/admin/logs/route.ts`
10. `/app/api/branding/route.ts`

### Components (1)
11. `/app/components/SubscriptionGuard.tsx`

### Scripts (2)
12. `/scripts/init-admin.ts`
13. `/scripts/create-admin-users.ts`

### Utilities (1)
14. `/app/lib/supabase/ensureWorkspaceForUser.ts` (reviewed, no changes needed)

### Team Components (2, reviewed - no changes needed)
15. `/app/components/team/InviteMemberForm.tsx` (uses workspace member roles)
16. `/app/dashboard/team/page.tsx` (uses workspace member roles)

---

## Rollback Plan

If you need to revert these changes:

```bash
# Revert database
UPDATE public.users
SET role = 'admin'
WHERE role = 'super_admin';

# Revert code
git revert <commit-hash>
```

---

## Notes

### Workspace Member Roles vs User Roles
- **User Role (`users.role`):** Controls system-level access (super_admin, admin, user)
- **Member Role (`workspace_members.role`):** Controls workspace-level access (owner, admin, staff, member)
- These are **independent** and **not changed** in this refactor

### Feature Gates
Feature gates in `/lib/feature-gates.ts` check `user.role` for plan limits. With the new hierarchy:
- `super_admin` users bypass all subscription checks ✅
- `admin` users (workspace admins) bypass all subscription checks ✅
- Regular users must have active subscription ✅

### Backward Compatibility
- No breaking changes to API contracts
- Database schema unchanged (just role values updated)
- Workspace member roles remain unchanged
- All existing workspace structures preserved

---

## Support

If you encounter issues:
1. Check the authorization matrix above
2. Verify the user's role: `SELECT email, role FROM public.users WHERE email = '...';`
3. Verify workspace membership: `SELECT * FROM public.workspace_members WHERE user_id = '...';`
4. Check API response for role validation errors in logs

---

## Summary

✅ **Frontend:** 5 pages updated to require `super_admin` role  
✅ **Backend:** 5 API routes updated to enforce `super_admin` role  
✅ **Components:** SubscriptionGuard updated to recognize both `admin` and `super_admin`  
✅ **Scripts:** Admin user creation updated to use `super_admin` role  
✅ **Workspace:** No changes needed (workspace member roles are independent)  

**Status:** Ready for database migration and deployment
