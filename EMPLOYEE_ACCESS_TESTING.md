# Employee Access Testing & Quick Reference

## Quick Lookup

### The 4 Roles & Routes

```
┌───────────────────┬──────────────────────┬────────────────────┐
│ Role              │ Route                │ workspace_id       │
├───────────────────┼──────────────────────┼────────────────────┤
│ super_admin       │ /admin               │ NULL               │
│ platform_staff    │ /admin/support       │ Platform WS*       │
│ admin (client)    │ /dashboard           │ Client workspace   │
│ employee          │ /employees/dashboard │ Assigned workspace │
└───────────────────┴──────────────────────┴────────────────────┘

* Platform WS = 00000000-0000-0000-0000-000000000001
```

### Who Can Invite Whom

```
┌──────────────────┬──────────────────┬──────────────────────┐
│ Inviter Role     │ Can Invite       │ To Workspace         │
├──────────────────┼──────────────────┼──────────────────────┤
│ super_admin      │ platform_staff   │ Platform WS only     │
│ super_admin      │ employee         │ Any client workspace │
│ admin (client)   │ employee         │ Own workspace only   │
│ employee         │ (nobody)         │ (N/A)                │
└──────────────────┴──────────────────┴──────────────────────┘
```

### Employee Invariants (Guaranteed)

- ✅ **Single Workspace**: Each employee belongs to EXACTLY ONE workspace
- ✅ **Cannot Be Admin**: Cannot be both employee and admin simultaneously
- ✅ **Has workspace_id**: All employees have a non-null workspace_id
- ✅ **RPC Returns workspace_id**: `rpc_get_user_access()` returns employee's workspace
- ✅ **Middleware Routes Correctly**: Employee routes to `/employees/dashboard` only
- ✅ **API Validates Access**: API layer checks workspace_id matches
- ✅ **No Cross-Workspace Access**: Cannot access another workspace's data

---

## Test Cases

### TC-1: Employee Login & Redirect

**Setup**: Employee exists in workspace A

**Steps**:
```
1. Navigate to /login
2. Enter employee credentials (email, password)
3. Submit login form
```

**Expected**:
```
✓ Login succeeds
✓ API returns { role: 'employee', workspace_id: 'A-uuid' }
✓ Login page redirects to /employees/dashboard
✓ Middleware validates: role='employee' + path starts with '/employees/dashboard'
✓ Employee dashboard loads
```

**Verify**:
- Browser at `/employees/dashboard`
- No error messages
- Dashboard shows employee's workspace data

---

### TC-2: Employee Cannot Access Client Admin Dashboard

**Setup**: Employee in workspace A

**Steps**:
```
1. Employee logged in at /employees/dashboard
2. Manually navigate to /dashboard
   OR
   Try accessing /dashboard via direct URL
```

**Expected**:
```
✓ Middleware intercepts request
✓ Detects: role='employee' + path='/dashboard' (not /employees/dashboard)
✓ Redirects to /employees/dashboard
✓ Shows flash message: "Access denied"
```

**Verify**:
- Browser redirected back to `/employees/dashboard`
- Admin dashboard never loads

---

### TC-3: Employee Cannot Access Super Admin Panel

**Setup**: Employee in workspace A

**Steps**:
```
1. Employee logged in
2. Try to navigate to /admin
```

**Expected**:
```
✓ Middleware intercepts: role='employee' + path='/admin'
✓ Redirects to /employees/dashboard
✓ Shows flash message: "Access denied"
```

**Verify**:
- Browser redirected to `/employees/dashboard`
- Admin panel never loads

---

### TC-4: Employee Cannot Access Another Workspace

**Setup**: 
- Employee1 in Workspace A
- Workspace B exists (different client)

**Steps**:
```
1. Employee1 logged in
2. Try to access workspace B data via API:
   GET /api/employees/dashboard/messages?workspace_id=B-uuid
```

**Expected**:
```
✓ Middleware validates: role='employee' ✓, path='/employees/dashboard/*' ✓
✓ Request reaches API handler
✓ API handler checks: Is employee in workspace B?
✓ Database query: SELECT workspace_id FROM employees WHERE user_id=emp1
✓ Result: A-uuid (not B-uuid)
✓ API returns 403 Forbidden
```

**Verify**:
- Request fails with 403
- Employee cannot see workspace B data
- Error message: "Access denied" or "Workspace not found"

---

### TC-5: Employee Invite Creation - Admin Invites to Own Workspace

**Setup**: Admin of Workspace A

**Steps**:
```
1. Admin navigates to /dashboard/invite-employee
2. Enters email: "newstaff@client.com"
3. Submits form
```

**Expected**:
```
✓ Frontend calls POST /api/employees/invite
  {
    email: "newstaff@client.com",
    workspace_id: "A-uuid"
  }

✓ Backend:
  - Resolves admin from session
  - Calls rpc_create_employee_invite(A-uuid, ...)
  
✓ Migration 032 validates:
  - Inviter is admin of workspace A ✓
  - Role is 'employee' ✓
  - Workspace is A-uuid ✓
  
✓ Returns { invite_id, token }

✓ Backend sends email:
  "You've been invited to join a workspace at:
   https://app.com/invite?token=<secure-token>"
```

**Verify**:
- Invite record created in database
- Email sent to invited address
- Status is 'pending'

---

### TC-6: Employee Invite Creation - Admin Tries to Invite to Another Workspace

**Setup**: 
- Admin of Workspace A
- Workspace B exists (different client)

**Steps**:
```
1. Admin A tries to invite employee to workspace B
   POST /api/employees/invite
   {
     email: "newstaff@b.com",
     workspace_id: "B-uuid"
   }
```

**Expected**:
```
✓ Migration 032 validation:
  - Is inviter admin of workspace B? NO
  
✓ Returns 403 Forbidden
✓ Message: "Only workspace admin can invite employees"
✓ Invite NOT created
```

**Verify**:
- Request fails with 403
- No invite record in database
- Admin A cannot invite to workspace B

---

### TC-7: Employee Invite Acceptance - Valid Token

**Setup**: 
- Invite created with secure token
- Email sent to newstaff@client.com

**Steps**:
```
1. New employee clicks link: /invite?token=<token>
2. Navigates to invite acceptance page
3. Enters: full_name, phone
4. Submits form
```

**Expected**:
```
✓ Frontend calls POST /api/auth/accept-employee-invite
  {
    token: "<token>",
    full_name: "New Staff",
    phone: "+1234567890"
  }

✓ Migration 033 processing:
  - Find invite with token ✓
  - Status is 'pending' ✓
  - Not expired ✓
  - Resolve user for email "newstaff@client.com" ✓
  - Check user NOT already employee ✓
  - Check user NOT already admin ✓
  
✓ Insert employee record:
  - user_id = "new-staff-uuid"
  - workspace_id = "A-uuid"
  - full_name = "New Staff"
  - phone = "+1234567890"

✓ Update invite:
  - status = 'accepted'
  - accepted_at = NOW()

✓ Create Supabase auth session
✓ Return redirect to /employees/dashboard
```

**Verify**:
- Invite accepted and marked in database
- Employee record created with workspace_id
- Employee logged in and at /employees/dashboard
- Employee can now login with their credentials

---

### TC-8: Employee Invite Acceptance - Invalid Token

**Setup**: Invalid or already-used token

**Steps**:
```
1. Click invite link with bad token
   /invite?token=bad-token
2. Attempt to accept
```

**Expected**:
```
✓ Migration 033 finds no valid pending invite
✓ Raises exception: "Invalid or already used invite token"
✓ API returns 400 Bad Request
✓ Error message shown to user
```

**Verify**:
- Request fails with 400
- No employee record created
- User not logged in

---

### TC-9: Employee Invite Acceptance - User Already Employee

**Setup**: 
- User already accepted an invite to workspace C
- Tries to accept another invite to workspace A

**Steps**:
```
1. User clicks second invite link
2. Attempts to accept with valid token
```

**Expected**:
```
✓ Migration 033 processing:
  - Find invite ✓
  - Status is 'pending' ✓
  - Resolve user ✓
  
✓ Check: Is user already employee? YES (in workspace C)
✓ Raises exception: "User is already an employee in another workspace"
✓ API returns 400 Bad Request
```

**Verify**:
- User remains employee in workspace C only
- No record created for workspace A
- User not logged in to second workspace

---

### TC-10: Platform Staff Invite - Super Admin Only

**Setup**: Super admin wants to invite platform staff

**Steps**:
```
1. Super admin creates invite
   POST /api/auth/invite
   {
     email: "support@retail-assist.com",
     role: "platform_staff",
     workspace_id: "00000000-0000-0000-0000-000000000001"
   }
```

**Expected**:
```
✓ Migration 032 validation:
  - Inviter is super_admin ✓
  - Role is 'platform_staff' ✓
  - Workspace is platform workspace ✓
  
✓ Invite created
```

**Verify**:
- Invite created with role='platform_staff'
- workspace_id = platform workspace
- Email sent to support@retail-assist.com

---

### TC-11: Platform Staff Invite - Client Admin Cannot Invite

**Setup**: Client admin tries to invite platform staff

**Steps**:
```
1. Admin tries to create platform_staff invite
   POST /api/auth/invite
   {
     email: "staff@retail-assist.com",
     role: "platform_staff",
     workspace_id: "<whatever>"
   }
```

**Expected**:
```
✓ Migration 032 validation:
  - Role is 'platform_staff'
  - Inviter is super_admin? NO
  
✓ Raises exception: "Only super admin can invite platform_staff"
✓ API returns 403 Forbidden
```

**Verify**:
- Request fails with 403
- No invite created
- Client admin cannot create platform_staff invites

---

### TC-12: Platform Staff Invite to Non-Platform Workspace

**Setup**: Super admin tries to invite platform_staff to a client workspace

**Steps**:
```
1. Super admin tries:
   POST /api/auth/invite
   {
     email: "staff@retail-assist.com",
     role: "platform_staff",
     workspace_id: "A-uuid"  // Client workspace, not platform
   }
```

**Expected**:
```
✓ Migration 032 validation:
  - Inviter is super_admin ✓
  - Role is 'platform_staff' ✓
  - Workspace is platform workspace? NO
  
✓ Raises exception: "Platform staff must be invited to platform workspace only"
✓ API returns 400 Bad Request
```

**Verify**:
- Request fails with 400
- No invite created
- Platform staff can ONLY be invited to platform workspace

---

### TC-13: Super Admin Login Flow

**Setup**: Super admin user

**Steps**:
```
1. Navigate to /login
2. Enter super admin credentials
3. Submit
```

**Expected**:
```
✓ Login succeeds
✓ API calls rpc_get_user_access()
✓ Returns { role: 'super_admin', workspace_id: NULL }
✓ Login page redirects to /admin
✓ Middleware validates: role='super_admin' + path starts with '/admin'
✓ Admin panel loads
```

**Verify**:
- At `/admin`
- Can access /admin/* routes
- Cannot access /dashboard, /employees/dashboard, /admin/support

---

### TC-14: Platform Staff Login Flow

**Setup**: Platform staff user

**Steps**:
```
1. Navigate to /login
2. Enter platform staff credentials
3. Submit
```

**Expected**:
```
✓ Login succeeds
✓ API calls rpc_get_user_access()
✓ Returns { role: 'platform_staff', workspace_id: '00000000-0000-0000-0000-000000000001' }
✓ Login page redirects to /admin/support
✓ Middleware validates: role='platform_staff' + path starts with '/admin/support'
✓ Support panel loads
```

**Verify**:
- At `/admin/support`
- Can access /admin/support/* routes
- Cannot access /admin (without /support), /dashboard, /employees/dashboard

---

### TC-15: Client Admin Login Flow

**Setup**: Admin of workspace A

**Steps**:
```
1. Navigate to /login
2. Enter admin credentials
3. Submit
```

**Expected**:
```
✓ Login succeeds
✓ API calls rpc_get_user_access()
✓ Returns { role: 'admin', workspace_id: 'A-uuid' }
✓ Login page redirects to /dashboard
✓ Middleware validates: role='admin' + path starts with '/dashboard'
✓ Dashboard loads
```

**Verify**:
- At `/dashboard`
- Can access /dashboard/* routes
- Cannot access /admin, /admin/support, /employees/dashboard

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Database migrated to include all 035 migrations
- [ ] Middleware deployed
- [ ] Auth endpoints deployed
- [ ] Login/signup pages deployed
- [ ] Test users created:
  - [ ] super_admin account
  - [ ] platform_staff account
  - [ ] client admin (workspace A)
  - [ ] client admin (workspace B)
  - [ ] employee (workspace A)
  - [ ] test email for invites

### Login & Access Tests
- [ ] TC-1: Employee login & redirect
- [ ] TC-13: Super admin login
- [ ] TC-14: Platform staff login
- [ ] TC-15: Client admin login

### Authorization Tests
- [ ] TC-2: Employee cannot access /dashboard
- [ ] TC-3: Employee cannot access /admin
- [ ] TC-4: Employee cannot access other workspace

### Invite Creation Tests
- [ ] TC-5: Admin invites to own workspace
- [ ] TC-6: Admin cannot invite to other workspace
- [ ] TC-10: Super admin invites platform staff
- [ ] TC-11: Client admin cannot invite platform staff
- [ ] TC-12: Platform staff invited to platform workspace only

### Invite Acceptance Tests
- [ ] TC-7: Valid token accepted
- [ ] TC-8: Invalid token rejected
- [ ] TC-9: User already employee rejected

### Edge Cases
- [ ] Employee logs out and back in
- [ ] Employee session expires and refreshes
- [ ] Multiple employees in same workspace
- [ ] Admin manages multiple employees

---

## Debugging Commands

### Check Employee's Role
```sql
SELECT rpc_get_user_access();
-- Should return: (user_id, workspace_id, 'employee')
```

### Check Employee's Workspace
```sql
SELECT workspace_id FROM public.employees 
WHERE user_id = 'employee-uuid';
-- Should return single workspace_id
```

### Check Invite Status
```sql
SELECT id, email, status, created_at, accepted_at 
FROM public.employee_invites 
WHERE token = 'token-value';
-- Status should be: 'pending' or 'accepted'
```

### Check Employee Cannot Be Admin
```sql
-- This query should return NO rows
SELECT e.user_id 
FROM public.employees e
JOIN public.admin_access aa ON e.user_id = aa.user_id
WHERE e.workspace_id = aa.workspace_id;
-- Result: (empty) - Good!
```

### Check Employee Single Workspace
```sql
-- Count workspaces per user
SELECT user_id, COUNT(*) as workspace_count
FROM public.employees
GROUP BY user_id
HAVING COUNT(*) > 1;
-- Result: (empty) - Good! Each user in only one workspace
```

---

**Test Status**: Ready for execution
**Last Updated**: January 16, 2026
