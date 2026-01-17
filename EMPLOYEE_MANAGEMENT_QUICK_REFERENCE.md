# Employee Management System - Quick Reference

## 🚀 Quick Start

### For Super Admin (Platform Staff)
```
Route: /admin/platform-staff
Role: super_admin only
Workspace: NULL
Actions: Invite, Edit, Delete platform staff
```

### For Client Admin (Business Employees)
```
Route: /dashboard/[workspaceId]/employees
Role: admin only
Workspace: User's workspace_id
Actions: Invite, Edit, Delete workspace employees
```

---

## 💻 Code Examples

### Using useEmployees Hook
```typescript
import { useEmployees } from '@/app/hooks/useEmployees';

// For platform staff (super admin)
const { employees, loading, error, fetchEmployees, createEmployee, updateEmployee, deleteEmployee } = 
  useEmployees(null);

// For workspace employees (admin)
const { employees, loading, error, fetchEmployees, createEmployee, updateEmployee, deleteEmployee } = 
  useEmployees(workspaceId);

// Fetch employees
useEffect(() => {
  fetchEmployees();
}, []);

// Create employee invite
const result = await createEmployee('user@example.com', 'employee');
if (result.success) {
  console.log('Invite sent:', result.invite);
}

// Update employee
const result = await updateEmployee(employeeId, {
  full_name: 'John Doe',
  is_active: true,
});

// Delete employee
const result = await deleteEmployee(employeeId);
```

### Using Components
```typescript
// Invite Modal
<InviteEmployeeModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSubmit={async (email, role) => {
    const result = await createEmployee(email, role);
    return result.success;
  }}
  isPlatformStaff={true}
/>

// Edit Modal
<EditEmployeeModal
  isOpen={showEditModal}
  employee={selectedEmployee}
  onClose={() => setShowEditModal(false)}
  onSubmit={async (id, updates) => {
    const result = await updateEmployee(id, updates);
    return result.success;
  }}
/>

// Employee Table
<EmployeeTable
  employees={employees}
  loading={loading}
  onEdit={(employee) => setSelected(employee)}
  onDelete={(employee) => deleteEmployee(employee.id)}
  isDeleting={deletingIds}
/>
```

---

## 🔐 Security Notes

### Workspace Scoping
- ✅ Enforced at API level (server-side)
- ✅ URL params must match authenticated user
- ✅ Cannot change employee workspace_id
- ✅ Cross-workspace access returns 404

### Role Validation
- ✅ Middleware enforces super_admin → /admin redirect
- ✅ Pages validate role on mount
- ✅ API endpoints check role and workspace
- ✅ RPC returns authoritative role/workspace

### Authorization Flow
```
1. User visits page
   ↓
2. Page calls /api/auth/me
   ↓
3. Verify role (super_admin OR admin)
   ↓
4. Verify workspace_id if admin
   ↓
5. Load page OR redirect to /unauthorized
   ↓
6. All API calls include workspace context
   ↓
7. API endpoint validates authorization
```

---

## 📊 API Endpoints Reference

### GET /api/employees
Fetch all employees in current admin's workspace
```bash
curl -H "Cookie: sb-auth-token=..." \
  http://localhost:5000/api/employees

# Response
{
  "employees": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "workspace_id": "uuid",
      "is_active": true,
      "created_at": "2025-01-17T...",
      "updated_at": "2025-01-17T...",
      "email": "user@example.com",
      "full_name": "John Doe",
      "phone": "+1...",
      "role": "employee"
    }
  ]
}
```

### POST /api/employees
Create employee invite
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-auth-token=..." \
  -d '{
    "email": "new@example.com",
    "role": "employee",
    "workspace_id": "uuid" # Optional for admins
  }' \
  http://localhost:5000/api/employees

# Response
{
  "success": true,
  "message": "Invite created successfully",
  "invite": {
    "id": "uuid",
    "token": "128-bit-hex-string",
    "email": "new@example.com"
  }
}
```

### GET /api/employees/[id]
Fetch single employee
```bash
curl -H "Cookie: sb-auth-token=..." \
  http://localhost:5000/api/employees/employee-id
```

### PUT /api/employees/[id]
Update employee
```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-auth-token=..." \
  -d '{
    "full_name": "Jane Doe",
    "phone": "+1...",
    "is_active": false
  }' \
  http://localhost:5000/api/employees/employee-id
```

### DELETE /api/employees/[id]
Delete employee
```bash
curl -X DELETE \
  -H "Cookie: sb-auth-token=..." \
  http://localhost:5000/api/employees/employee-id

# Response
{
  "success": true,
  "message": "Employee deleted successfully"
}
```

### GET /api/debug/env
Check environment variables
```bash
curl http://localhost:5000/api/debug/env

# Response
{
  "status": "OK",
  "environment": "development",
  "variables": {
    "SUPABASE_URL": "SET",
    "SUPABASE_SERVICE_ROLE_KEY": "SET (secret)",
    "NEXT_PUBLIC_SUPABASE_URL": "https://...",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "SET",
    "NEXT_PUBLIC_USE_MOCK_SUPABASE": "false"
  },
  "checks": {
    "canConnectToSupabase": true
  }
}
```

---

## 🧪 Testing Guide

### Test Employee Invite
```typescript
const result = await createEmployee('test@example.com', 'admin');
expect(result.success).toBe(true);
expect(result.invite.token).toBeDefined();
expect(result.invite.token.length).toBe(32); // 128-bit hex
```

### Test Workspace Isolation
```typescript
// Create hook with workspace_id
const { employees } = useEmployees('workspace-123');

// All fetches should include workspace_id in filter
// Cross-workspace employees should return 404
```

### Test Role Authorization
```typescript
// Attempt to access as employee (not admin)
// Should redirect to /unauthorized

// Attempt to access super admin page as admin
// Should redirect to /dashboard
```

---

## 📋 Common Tasks

### Add Employee to Workspace
```typescript
const result = await createEmployee('user@company.com', 'employee');
if (result.success) {
  await fetchEmployees(); // Refresh list
}
```

### Promote Employee to Admin
```typescript
const result = await updateEmployee(employeeId, { role: 'admin' });
```

### Deactivate Employee
```typescript
const result = await updateEmployee(employeeId, { is_active: false });
```

### Remove Employee
```typescript
const result = await deleteEmployee(employeeId);
if (result.success) {
  // Employee removed from local state automatically
}
```

### Check Supabase Connection
```bash
curl http://localhost:5000/api/debug/env
# Look for "status": "OK" and "canConnectToSupabase": true
```

---

## ⚠️ Error Handling

### Common Errors
| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Not authenticated | Redirect to login |
| 403 | Not authorized | Redirect to /unauthorized |
| 404 | Employee not found | Check workspace_id match |
| 400 | Invalid request | Check input validation |
| 500 | Server error | Check logs, retry |

### Error Messages
```typescript
// Hook returns standardized errors
{
  success: false,
  error: "You do not have permission to view employees"
}

// API errors included in response
{
  error: "Failed to delete employee"
}
```

---

## 📱 Responsive Design

### Desktop (≥768px)
- Full-width table
- 5 columns (Name, Email, Role, Status, Actions)
- Inline action buttons
- Stats grid: 4 columns

### Mobile (<768px)
- Card-based layout
- Stacked information
- Full-width action buttons
- Stats grid: 2 columns

---

## 🔍 Debugging

### Enable Logging
```typescript
// Logs included in all pages and hooks
console.log('[PlatformStaffPage] Resolved role:', role);
console.log('[useEmployees] Fetch error:', message);
console.log('[/api/employees GET] Admin fetched employees');
```

### Check Environment
```bash
curl http://localhost:5000/api/debug/env
# Verify all checks pass
```

### Browser DevTools
1. Network tab: Check API responses
2. Console: Look for [Page] or [API] logs
3. Storage: Check auth token in cookies
4. React DevTools: Inspect component state

---

## 🚨 Troubleshooting

### "Access denied" on page
- [ ] Verify your role: Check `/api/auth/me`
- [ ] Verify workspace_id matches URL
- [ ] Check middleware redirects in console logs

### Employees list is empty
- [ ] Check `/api/debug/env` - Supabase connected?
- [ ] Check browser console for API errors
- [ ] Verify you have employees in this workspace

### Invite not sending
- [ ] Check email format is valid
- [ ] Check role is "employee" or "admin"
- [ ] Verify workspace_id in request
- [ ] Check network response in DevTools

### Cross-workspace access error
- [ ] URL workspace_id must match user's workspace_id
- [ ] Super admin must navigate to /admin/platform-staff
- [ ] Client admin cannot access other workspace employee pages

---

**Version**: 1.0.0
**Last Updated**: January 17, 2026
