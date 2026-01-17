# Sidebar Employees Link Visibility Guide

## Overview
The Employees link is now visible in the sidebar for both **super_admin** and **client_admin** roles with correct routes and layouts.

---

## 1. super_admin Dashboard

### Where It Appears
- **Route**: `/admin` (and all sub-routes: `/admin/users`, `/admin/settings`, etc.)
- **Layout**: `app/admin/layout.tsx` (newly created)
- **Sidebar**: Visible on the left side
- **Link Position**: Between Billing and Settings

### Employees Link Details
| Property | Value |
|----------|-------|
| **Role Required** | `super_admin` only |
| **Display Name** | Employees |
| **Icon** | 👥 |
| **Route** | `/admin/employees` |
| **Visibility** | Always visible (no workspace check needed) |

### Visual Layout (super_admin Dashboard)
```
┌─────────────────────────────────┐  ┌────────────────────────────┐
│  R Retail Pro                   │  │  Topbar (User Menu)         │
├─────────────────────────────────┤  ├────────────────────────────┤
│                                 │  │                            │
│ 📊 Dashboard                    │  │  Admin Dashboard           │
│ 📈 Analytics                    │  │  - User Management        │
│ 🤖 AI Agents                    │  │  - Statistics             │
│ 🔗 Integrations                 │  │  - Billing Overview       │
│ 💳 Billing                      │  │                            │
│ 👥 Employees ← NEW LINK!        │  │                            │
│ ⚙️ Settings                     │  │                            │
│                                 │  │                            │
│ v1.0.0                         │  │                            │
│ ? Help & Support               │  │                            │
└─────────────────────────────────┘  └────────────────────────────┘
```

---

## 2. client_admin Dashboard

### Where It Appears
- **Route**: `/dashboard/[workspaceId]` (e.g., `/dashboard/550e8400-e29b-41d4-a716-446655440000`)
- **Layout**: `app/dashboard/layout.tsx` (existing)
- **Sidebar**: Visible on the left side
- **Link Position**: Between Billing and Settings

### Employees Link Details
| Property | Value |
|----------|-------|
| **Role Required** | `admin` (client_admin) |
| **WorkspaceId Required** | YES - must be valid UUID in URL |
| **Display Name** | Employees |
| **Icon** | 👥 |
| **Route** | `/dashboard/[workspaceId]/employees` |
| **Visibility** | Only when workspaceId detected in URL |

### Visual Layout (client_admin Dashboard)
```
┌─────────────────────────────────┐  ┌────────────────────────────┐
│  R Retail Pro                   │  │  Topbar (User Menu)         │
├─────────────────────────────────┤  ├────────────────────────────┤
│                                 │  │                            │
│ 📊 Dashboard                    │  │  Client Dashboard          │
│ 📈 Analytics                    │  │  - Workspace Overview      │
│ 🤖 AI Agents                    │  │  - Messages                │
│ 🔗 Integrations                 │  │  - Analytics              │
│ 💳 Billing                      │  │                            │
│ 👥 Employees ← NEW LINK!        │  │                            │
│ ⚙️ Settings                     │  │                            │
│                                 │  │                            │
│ v1.0.0                         │  │                            │
│ ? Help & Support               │  │                            │
└─────────────────────────────────┘  └────────────────────────────┘
```

---

## 3. Other Roles (employee, agent)

### Employees Link Visibility
- **Status**: ❌ NOT VISIBLE
- **Reason**: Only `admin` and `super_admin` roles can see this link
- **Sidebar Shows**: All base links except Employees

```
┌─────────────────────────────────┐
│  R Retail Pro                   │
├─────────────────────────────────┤
│                                 │
│ 📊 Dashboard                    │
│ 📈 Analytics                    │
│ 🤖 AI Agents                    │
│ 🔗 Integrations                 │
│ 💳 Billing                      │
│ ⚙️ Settings                     │ ← No Employees link
│                                 │
│ v1.0.0                         │
│ ? Help & Support               │
└─────────────────────────────────┘
```

---

## 4. Implementation Details

### Sidebar Component Logic

#### super_admin Detection
```typescript
if (user.role === "super_admin") {
  return { href: "/admin/employees", label: "Employees", icon: "👥" };
}
```
- No workspace ID needed
- Always visible when on `/admin` routes
- Layout: `app/admin/layout.tsx`

#### client_admin Detection
```typescript
if (user.role === "admin" && workspaceId) {
  return { 
    href: `/dashboard/${workspaceId}/employees`, 
    label: "Employees", 
    icon: "👥" 
  };
}
```
- Requires `workspaceId` from URL pathname
- UUID detected by checking for hyphens (`parts[2].includes("-")`)
- Layout: `app/dashboard/layout.tsx`

#### Other Roles
```typescript
// No Employees link returned
return null;
```

---

## 5. File Changes Made

### Created Files
- ✅ `app/admin/layout.tsx` - Admin page wrapper with Sidebar

### Modified Files
- ✅ `app/components/Sidebar.tsx` - Updated role-based logic
  - Added `getEmployeesLink()` function
  - Proper super_admin support
  - Proper client_admin workspace detection
  - Debug logging for verification

---

## 6. Testing Instructions

### Test Case 1: super_admin
**Credentials**: samuelhelp80@gmail.com / 123456

1. Login to application
2. Middleware redirects to `/admin`
3. Admin layout renders with Sidebar
4. **Verify**: Employees link visible in sidebar
5. **Click**: Should navigate to `/admin/employees`
6. **Browser Console**: Should see logs:
   ```
   [Sidebar] super_admin detected: showing Employees link to /admin/employees
   [Sidebar] Render state: { pathname: "/admin", ..., employeesLinkShown: true }
   ```

### Test Case 2: client_admin
**Credentials**: tomson@demo.com / 123456

1. Login to application
2. Middleware redirects to `/dashboard/[workspaceId]`
3. Dashboard layout renders with Sidebar
4. **Verify**: Employees link visible in sidebar (only if workspaceId in URL)
5. **Click**: Should navigate to `/dashboard/[workspaceId]/employees`
6. **Browser Console**: Should see logs:
   ```
   [Sidebar] client_admin detected with workspace: { workspace_id: "xxx...", employees_route: "..." }
   [Sidebar] Render state: { pathname: "/dashboard/xxx...", ..., employeesLinkShown: true }
   ```

### Test Case 3: Other Roles (employee, agent)
1. Login with employee or agent account
2. Navigate to appropriate dashboard
3. **Verify**: Employees link NOT visible in sidebar
4. **Browser Console**: Should see logs:
   ```
   [Sidebar] Role [role] does not have access to Employees link
   [Sidebar] Render state: { ..., employeesLinkShown: false }
   ```

---

## 7. Troubleshooting

### Employees link not showing for super_admin

**Checklist**:
1. ✅ User role is `super_admin` in `/api/auth/me` response
2. ✅ Current route is `/admin/*` (check browser URL)
3. ✅ `app/admin/layout.tsx` file exists
4. ✅ Sidebar component imported in admin layout
5. Check browser console for debug logs

### Employees link not showing for client_admin

**Checklist**:
1. ✅ User role is `admin` in `/api/auth/me` response
2. ✅ Current route is `/dashboard/[uuid]/*` (check browser URL)
3. ✅ UUID format in URL (has hyphens like `550e8400-e29b-41d4-a716-446655440000`)
4. ✅ Sidebar component imported in dashboard layout
5. Check browser console for debug logs

### Debug Mode

Open browser DevTools (F12) and check the Console tab for:
- `[Sidebar] User fetched successfully:` logs
- `[Sidebar] Render state:` logs showing all relevant info

---

## 8. Summary Table

| Feature | super_admin | client_admin | Other Roles |
|---------|------------|-------------|------------|
| **Visibility** | ✅ Yes | ✅ Yes (if workspaceId) | ❌ No |
| **Route** | `/admin/employees` | `/dashboard/[uuid]/employees` | N/A |
| **Layout** | `app/admin/layout.tsx` | `app/dashboard/layout.tsx` | N/A |
| **Icon** | 👥 | 👥 | N/A |
| **Position** | After Billing | After Billing | N/A |
| **Workspace Required** | No | Yes | N/A |

---

## 9. Build Status
✅ **Compiled successfully** - Ready for production testing

---

## 10. Next Steps

1. **Deploy** to staging environment
2. **Test** both super_admin and client_admin login flows
3. **Verify** Employees link appears in correct locations
4. **QA Test** clicking links navigates to correct pages
5. **Check console logs** for any errors
6. **Deploy** to production when verified

---

**Last Updated**: January 17, 2026  
**Status**: Implementation Complete ✅
