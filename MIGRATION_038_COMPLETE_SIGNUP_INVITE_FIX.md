# Complete Signup & Invite Flow Fix - Migration Guide

**Date**: January 22, 2026  
**Purpose**: Fix signup flow, invite acceptance, and multi-account support  
**Status**: Ready for Deployment

---

## 📋 Executive Summary

The signup and invite flows had multiple interrelated issues preventing new users and invited employees from successfully joining workspaces. This migration provides a comprehensive fix covering:

✅ **Users table**: Added missing columns (role, plan_type, payment_status, etc.)  
✅ **Employees table**: Fixed schema inconsistency (business_id → workspace_id)  
✅ **Sessions table**: Fixed FK to reference `public.users.id` (not auth.users.id)  
✅ **Auth trigger**: Auto-creates user row on signup  
✅ **RPC functions**: Updated to handle super_admin and multi-account scenarios  
✅ **RLS policies**: Comprehensive access control for all roles  
✅ **Employee invites**: Added full_name column and proper permissions  

---

## 🔍 Analysis & Findings

### Database Schema Mismatches

| Issue | Frontend Expects | Current DB | Fixed In |
|-------|-----------------|-----------|----------|
| Users columns | role, plan_type, phone, business_name | Missing | Phase 1 |
| Employees FK | workspace_id | business_id | Phase 2 |
| Sessions FK | public.users.id | auth.users.id | Phase 4 |
| Invite full_name | full_name in invites | Missing | Phase 3 |
| Admin permissions | admin_access checks | Incomplete RLS | Phase 8 |

### Expected Data Structures

#### **Signup Flow** (`/api/auth/signup`)
```typescript
POST /api/auth/signup
{
  email: string,
  password: string,
  business_name: string,
  phone: string,
  full_name?: string,
  plan_type?: 'starter' | 'pro' | 'enterprise' (default: 'starter')
}
```

**Expected Results**:
1. `auth.users` row created
2. `public.users` row auto-created via trigger with auth_uid link
3. `public.workspaces` created with owner_id = users.id
4. `public.admin_access` entry with user as 'admin'
5. `public.workspace_members` entry with role 'admin'
6. Session created with user_id = public.users.id

#### **Invite Acceptance Flow** (`/api/employees/accept-invite`)
```typescript
POST /api/employees/accept-invite?token=<invite_token>
{
  email: string,
  first_name: string,
  last_name?: string,
  password: string
}
```

**Expected Results**:
1. Verify invite token exists and is pending
2. Verify email matches invite email
3. Create auth.users if not exists
4. Create or update public.users with auth_uid
5. Create public.employees record
6. Update invite status to 'accepted'

#### **Admin Access** (`rpc_get_user_access`)
Returns all admin access records for the authenticated user:
```sql
SELECT user_id, workspace_id, role FROM admin_access 
WHERE user_id = auth.uid()
```

**Expected Roles**:
- `super_admin` (workspace_id = NULL) - Platform admin
- `admin` (workspace_id = UUID) - Workspace admin
- `platform_staff` (workspace_id = NULL) - Support staff

---

## 📊 Table Schema Changes

### Phase 1: Users Table

**Added Columns**:
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS
  - role TEXT (super_admin, platform_staff, admin, user)
  - plan_type TEXT (starter, pro, enterprise)
  - payment_status TEXT (unpaid, paid, pending)
  - subscription_status TEXT (pending, active, canceled, expired)
  - business_name TEXT
  - phone TEXT
```

### Phase 2: Employees Table

**Changes**:
- Rename `business_id` → `workspace_id` (for consistency)
- Add `full_name TEXT` (optional name of employee)
- Set `workspace_id NOT NULL`
- Add unique constraint: only one workspace per employee

### Phase 3: Employee Invites Table

**Added**:
- `full_name TEXT` (filled when invite accepted)
- Ensure `expires_at NOT NULL` (30 days from creation)

### Phase 4: Sessions Table

**Critical Fix**:
```sql
-- Was:
user_id UUID REFERENCES auth.users(id)

-- Now:
user_id UUID REFERENCES public.users(id)
```

This ensures `sessions.user_id` references the internal user ID, not the Supabase Auth UID.

---

## 🔐 RLS Policies

### Admin Access Table
- **SELECT**: User can see admins in workspaces they belong to OR they are super_admin
- **INSERT/UPDATE/DELETE**: Only workspace admins or super_admin

### Users Table
- **SELECT self**: User can read their own row
- **SELECT workspace members**: User can see other members of workspaces they're in

### Employee Invites Table
- **SELECT**: Only workspace admins can read invites for their workspace
- **INSERT**: Only workspace admins can create invites

### Employees Table
- **SELECT self**: Employee can read their own record
- **SELECT workspace**: Admin can see employees in their workspace

---

## 🚀 Deployment Steps

### Step 1: Pre-Migration Validation

Before running the migration, verify current state:

```sql
-- Check users table columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('role', 'plan_type', 'phone', 'business_name');

-- Check employees table columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'employees' AND column_name IN ('business_id', 'workspace_id');

-- Check sessions table FK
SELECT constraint_name, referenced_table_name 
FROM information_schema.referential_constraints 
WHERE table_name = 'sessions' AND column_name = 'user_id';
```

### Step 2: Apply Migration to Supabase

```bash
# Option 1: Using Supabase CLI
supabase migration up

# Option 2: Using Supabase Dashboard
# 1. Go to SQL Editor
# 2. Click "New Query"
# 3. Copy entire migration from 038_complete_signup_invite_flow_fix.sql
# 4. Run the query
```

### Step 3: Set Environment Variable (if needed)

```bash
# For super admin eligibility in signup
export SUPER_ADMIN_EMAIL="admin@example.com"
```

### Step 4: Post-Migration Verification

Run these queries to confirm everything was set up correctly:

```sql
-- 1. Verify users table has all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY column_name;

-- 2. Verify employees table uses workspace_id
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name IN ('business_id', 'workspace_id');

-- 3. Verify sessions FK
SELECT constraint_name, referenced_table_name, referenced_column_name
FROM information_schema.referential_constraints 
WHERE table_name = 'sessions';

-- 4. Verify employee_invites has full_name
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'employee_invites' AND column_name = 'full_name';

-- 5. Check RLS policies exist
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('users', 'admin_access', 'employee_invites', 'employees')
ORDER BY tablename;

-- 6. Verify admin_access has data (if existing admins)
SELECT COUNT(*), role FROM public.admin_access GROUP BY role;

-- 7. Check auth trigger exists
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

---

## 🧪 Testing the Flows

### Test 1: New User Signup

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "business_name": "Test Business",
    "phone": "+1-555-000-0001",
    "full_name": "Test User",
    "plan_type": "starter"
  }'

# Expected response:
# {
#   "success": true,
#   "user": { "id": "...", "email": "newuser@example.com", "role": "admin" },
#   "message": "Account created successfully"
# }

# Verify in DB:
SELECT * FROM public.users WHERE email = 'newuser@example.com';
SELECT * FROM public.workspaces WHERE owner_id = (SELECT id FROM public.users WHERE email = 'newuser@example.com');
SELECT * FROM public.admin_access WHERE user_id = (SELECT id FROM public.users WHERE email = 'newuser@example.com');
```

### Test 2: Employee Invite Creation

```sql
-- As admin user:
-- 1. Create invite
SELECT * FROM rpc_create_employee_invite(
  p_workspace_id := '<your-workspace-id>',
  p_email := 'employee@example.com',
  p_invited_by := '<admin-user-id>',
  p_role := 'employee'
);

-- Expected: Returns invite_id and token
-- 2. Verify invite created
SELECT * FROM public.employee_invites 
WHERE email = 'employee@example.com' AND status = 'pending';
```

### Test 3: Employee Invite Acceptance

```bash
# Get token from employee_invites table first
TOKEN="<token-from-invite>"

curl -X POST "http://localhost:3000/api/employees/accept-invite?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "password": "EmployeePassword123!"
  }'

# Expected response:
# {
#   "success": true,
#   "workspace_id": "...",
#   "user_id": "...",
#   "role": "employee",
#   "message": "Invite accepted successfully"
# }

# Verify in DB:
SELECT * FROM public.employees WHERE user_id = '<new-employee-user-id>';
SELECT status FROM public.employee_invites WHERE token = '$TOKEN';
```

### Test 4: Multiple Accounts

Create multiple user accounts and verify they can:
- Each create their own workspace
- Have separate admin_access records
- See only their own data via RLS
- Manage their own employees independently

```sql
-- For each user:
SELECT * FROM public.users WHERE auth_uid = '<auth-uid>';
SELECT * FROM public.workspaces WHERE owner_id = (SELECT id FROM public.users WHERE auth_uid = '<auth-uid>');
SELECT * FROM public.employees WHERE workspace_id = (SELECT id FROM public.workspaces WHERE owner_id = (SELECT id FROM public.users WHERE auth_uid = '<auth-uid>'));
```

---

## ⚠️ Known Limitations & Notes

### 1. Auth Trigger Race Condition
- The auth trigger (`on_auth_user_created`) creates the users row automatically
- In rare cases, there may be a delay (handled by `ensureInternalUser` with retry)
- If users row is missing after signup, manually insert:
  ```sql
  INSERT INTO public.users (auth_uid, email) 
  VALUES ('<auth-uid>', '<email>');
  ```

### 2. Employees Can't Be Admins
- A user cannot be both an employee AND admin simultaneously
- Enforced by trigger `check_employee_not_admin`
- If you need to promote an employee to admin:
  1. Delete from employees table
  2. Create admin_access record
  3. Update users.role if needed

### 3. Super Admin Workspace
- Super admins have `workspace_id = NULL` in admin_access
- They don't own a workspace
- `rpc_get_user_access()` will return NULL workspace_id for super admins

### 4. Session Management
- Sessions must use `public.users.id` as FK, not auth.users.id
- `sessionManager.create()` enforces this via `ensureInternalUser()`
- Check [INTERNAL_USER_ID_CONTRACT.md](../INTERNAL_USER_ID_CONTRACT.md) for details

---

## 🔄 Rollback Plan

If issues occur, you can rollback (though not recommended if data was added):

```sql
-- Option 1: Restore from backup (preferred)
-- Contact Supabase to restore from backup

-- Option 2: Manual rollback (if no production data loss)
-- Drop new columns (if they weren't critical):
ALTER TABLE public.users DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE public.users DROP COLUMN IF EXISTS plan_type CASCADE;
-- ... etc

-- Option 3: Revert migration
-- Supabase automatically tracks migrations - contact support to revert
```

---

## 📞 Troubleshooting

### Issue: "Token lookup database error"
**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in environment variables

### Issue: "User is already an employee in this workspace"
**Solution**: Check for duplicate employee records:
```sql
SELECT user_id, workspace_id, COUNT(*) 
FROM public.employees 
GROUP BY user_id, workspace_id 
HAVING COUNT(*) > 1;
```

### Issue: "Inviter must be a client admin to invite employees"
**Solution**: Verify inviter has admin_access record:
```sql
SELECT * FROM public.admin_access 
WHERE user_id = '<inviter-id>' AND workspace_id = '<workspace-id>';
```

### Issue: "Email does not match the invitation"
**Solution**: Check case sensitivity:
```sql
SELECT email FROM public.employee_invites WHERE id = '<invite-id>';
```

### Issue: RLS policy blocking access
**Solution**: Check user's admin_access records:
```sql
SELECT * FROM public.admin_access WHERE user_id = auth.uid();
```

---

## ✅ Success Criteria

After applying this migration, verify:

- [ ] New user can sign up and create account
- [ ] Workspace automatically created for new user
- [ ] User can log in with created credentials
- [ ] User can invite employees to workspace
- [ ] Employee can accept invite and create account
- [ ] Multiple users can create separate workspaces
- [ ] Each user only sees their own data
- [ ] Admin can only see their workspace's employees
- [ ] Sessions work correctly with proper user_id FK
- [ ] All RLS policies enforce correct access

---

## 📚 Related Documentation

- [INTERNAL_USER_ID_CONTRACT.md](../INTERNAL_USER_ID_CONTRACT.md) - User ID resolution strategy
- [SUPER_ADMIN_ROLE_CREATION_FIX.md](../SUPER_ADMIN_ROLE_CREATION_FIX.md) - Super admin setup
- [CLIENT_ADMIN_INVITATION_FLOW_IMPLEMENTATION_SUMMARY.md](../CLIENT_ADMIN_INVITATION_FLOW_IMPLEMENTATION_SUMMARY.md) - Invite flow details
- [EMPLOYEE_ACCESS_IMPLEMENTATION.md](../EMPLOYEE_ACCESS_IMPLEMENTATION.md) - Employee dashboard
- [API.md](../API.md) - API endpoint documentation

---

## 🎯 Next Steps

1. ✅ Run migration in Supabase
2. ✅ Run post-migration verification queries
3. ✅ Test signup flow with new account
4. ✅ Test invite flow with test user
5. ✅ Verify multiple accounts work independently
6. ✅ Check application logs for any errors
7. ✅ Monitor user feedback for issues
8. ⏭️ Deploy application update if needed

---

**Last Updated**: January 22, 2026  
**Migration Version**: 038_complete_signup_invite_flow_fix.sql  
**Status**: Ready for Production
