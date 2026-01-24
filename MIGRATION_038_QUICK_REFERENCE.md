# Migration 038 - Quick Reference Guide

## 🎯 What This Migration Fixes

| Issue | Symptom | Status |
|-------|---------|--------|
| Missing user columns | Signup creates user but no plan_type/role data | ✅ Fixed |
| Employees table inconsistency | Accept-invite fails to create employee record | ✅ Fixed |
| Sessions FK mismatch | Session management breaks due to ID mismatch | ✅ Fixed |
| RLS policies incomplete | Access control not properly enforced | ✅ Fixed |
| Auth trigger missing | User row not auto-created on signup | ✅ Fixed |
| Multi-account support | Multiple users interfere with each other | ✅ Fixed |

---

## 📋 Pre-Migration Checklist

- [ ] Backup Supabase database
- [ ] Notify users that brief downtime may occur
- [ ] Have rollback plan ready (contact Supabase)
- [ ] Set `SUPER_ADMIN_EMAIL` if needed
- [ ] Have test accounts ready to verify signup flow

---

## 🚀 Migration Steps

### Step 1: Run SQL Migration

**Option A: Supabase Dashboard**
```
1. Go to SQL Editor
2. Create new query
3. Copy entire 038_complete_signup_invite_flow_fix.sql
4. Click Run
5. Wait for completion (should take <1 minute)
```

**Option B: Supabase CLI**
```bash
supabase db push  # Pushes pending migrations
```

**Option C: psql Command**
```bash
psql -h your-project.db.supabase.co \
     -U postgres \
     -d postgres \
     -f 038_complete_signup_invite_flow_fix.sql
```

### Step 2: Verify Core Tables

Run these queries in SQL Editor to confirm:

```sql
-- 1. Users table columns
SELECT COUNT(*) as column_count FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('role', 'plan_type', 'phone', 'business_name');
-- Expected: 4

-- 2. Employees workspace_id
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'employees' AND column_name = 'workspace_id';
-- Expected: 1

-- 3. Employee invites full_name
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'employee_invites' AND column_name = 'full_name';
-- Expected: 1

-- 4. Admin access data
SELECT role, COUNT(*) FROM public.admin_access GROUP BY role;
-- Expected: Shows admin and/or super_admin entries
```

### Step 3: Test Signup Flow

```bash
# Create new test account
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser1@example.com",
    "password": "TestPassword123!",
    "business_name": "Test Co",
    "phone": "+1-555-0001",
    "plan_type": "starter"
  }'

# Expected: 200 OK with success: true
```

### Step 4: Verify Database Created Correctly

```sql
-- Check user was created
SELECT id, email, role, plan_type FROM public.users 
WHERE email = 'testuser1@example.com';

-- Check workspace was created
SELECT id, name, owner_id FROM public.workspaces 
WHERE owner_id = (SELECT id FROM public.users WHERE email = 'testuser1@example.com');

-- Check admin_access was created
SELECT * FROM public.admin_access 
WHERE user_id = (SELECT id FROM public.users WHERE email = 'testuser1@example.com');
```

### Step 5: Test Invite Flow

```bash
# Get admin user ID and workspace ID from above queries
ADMIN_ID="<user-id-from-step-4>"
WORKSPACE_ID="<workspace-id-from-step-4>"

# Create invite (as admin)
# Use Supabase Auth token for admin user
curl -X POST http://localhost:3000/api/workspace/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{
    "workspaceId": "'$WORKSPACE_ID'",
    "email": "employee@example.com",
    "role": "staff"
  }'

# Get the token from response or query database:
# SELECT token FROM public.employee_invites WHERE email = 'employee@example.com' LIMIT 1;

# Accept invite
TOKEN="<token-from-response>"
curl -X POST "http://localhost:3000/api/employees/accept-invite?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "password": "EmpPassword123!"
  }'

# Expected: 200 OK with success: true
```

### Step 6: Verify Multi-Account Support

Create 2-3 more test accounts and verify:
- [ ] Each has separate workspace
- [ ] Each can invite employees independently
- [ ] Employees only see their workspace data
- [ ] Cross-user interference: NONE

```sql
-- Count total users and workspaces
SELECT COUNT(*) as total_users FROM public.users;
SELECT COUNT(*) as total_workspaces FROM public.workspaces;

-- Verify 1:1 mapping for non-super-admin users
SELECT 
  COUNT(DISTINCT owner_id) as unique_owners,
  COUNT(*) as total_workspaces
FROM public.workspaces
WHERE owner_id NOT IN (
  SELECT user_id FROM public.admin_access 
  WHERE role = 'super_admin'
);
-- Expected: Both columns should have same count
```

---

## 📊 Key Changes Summary

### Users Table
```sql
-- Added columns:
role TEXT (super_admin, platform_staff, admin, user)
plan_type TEXT (starter, pro, enterprise)
payment_status TEXT (unpaid, paid, pending)
subscription_status TEXT (pending, active, canceled, expired)
business_name TEXT
phone TEXT
```

### Employees Table
```sql
-- Renamed: business_id → workspace_id
-- Added: full_name TEXT
-- Constraint: user_id UNIQUE (only one workspace per user)
```

### Sessions Table
```sql
-- Changed FK from auth.users.id → public.users.id
-- This ensures session.user_id references internal user ID
```

### Employee_Invites Table
```sql
-- Added: full_name TEXT
-- Constraint: expires_at NOT NULL (defaults to created_at + 30 days)
```

### RPC Functions Updated
```sql
rpc_create_user_profile()
  - Now handles super_admin properly
  - Creates admin_access with workspace_id=NULL for super_admin
  - Updates existing users instead of erroring

rpc_get_user_access()
  - Returns all admin_access records for current user
  - Includes super_admin records (workspace_id IS NULL)
```

---

## ⚠️ Important Notes

### For Admins
- **Don't delete employees manually** - Use proper deletion flow
- **Check admin_access before inviting** - Inviter must be workspace admin
- **Monitor invite expirations** - Invites expire after 30 days

### For Developers
- **Use ensureInternalUser()** before creating sessions
- **Check auth trigger** if user row missing after signup
- **Verify RLS policies** if access denied errors occur
- **Test with multiple accounts** before going to production

### For Users
- **Signup creates workspace automatically** - No extra step needed
- **Workspace owner is automatically admin** - Can invite employees
- **Employees can't be admins** - Remove from employees to promote
- **Invites expire** - Accept within 30 days

---

## 🔧 Troubleshooting Quick Reference

### Signup Not Working
```sql
-- Check if user row was created
SELECT * FROM public.users WHERE email = '<email>';

-- Check if auth user exists
SELECT * FROM auth.users WHERE email = '<email>';

-- Check if workspace created
SELECT * FROM public.workspaces WHERE owner_id = '<user-id>';
```

### Invite Not Sending
```sql
-- Verify inviter is admin
SELECT * FROM public.admin_access 
WHERE user_id = '<inviter-id>' AND role = 'admin';

-- Check invite created
SELECT * FROM public.employee_invites 
WHERE email = '<invitee-email>' AND status = 'pending';
```

### Accept Invite Fails
```sql
-- Check token exists
SELECT token, status, expires_at, created_at FROM public.employee_invites 
WHERE token = '<token-value>';

-- Verify not expired (now vs expires_at)
SELECT NOW(), expires_at FROM public.employee_invites 
WHERE token = '<token-value>';

-- Check email matches
SELECT email FROM public.employee_invites 
WHERE token = '<token-value>';
```

### RLS Access Denied
```sql
-- Check user's admin_access
SELECT * FROM public.admin_access 
WHERE user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid());

-- Check workspace membership
SELECT * FROM public.workspace_members 
WHERE user_id = (SELECT id FROM public.users WHERE auth_uid = auth.uid());
```

---

## 📞 Support

### Errors in Logs
Look for:
- `[SIGNUP]` prefix - signup flow
- `[INVITE ACCEPT]` prefix - invite acceptance
- `[ensureInternalUser]` prefix - user ID resolution

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "Inviter must be a client admin" | admin_access missing | Add admin_access record |
| "This invite has expired" | Over 30 days old | Create new invite |
| "Email does not match" | Case sensitivity | Check case in DB |
| "Invalid or expired invite token" | Token lookup failed | Verify token in DB |
| "Failed to create user profile" | Duplicate email | Check users table |

---

## ✅ Post-Migration Checklist

- [ ] Migration ran without errors
- [ ] All verification queries show expected results
- [ ] Test signup flow works
- [ ] Test invite flow works
- [ ] Multiple test accounts created successfully
- [ ] Each account has separate workspace
- [ ] No cross-user data leakage
- [ ] RLS policies enforcing correctly
- [ ] Application logs show no auth errors
- [ ] Performance acceptable (query times normal)
- [ ] Rollback plan still available if needed

---

## 🎓 Understanding the Flow

### New User Signup
```
1. POST /api/auth/signup
   ↓
2. Create auth.users (Supabase Auth)
   ↓
3. Auth trigger fires → create public.users row
   ↓
4. RPC rpc_create_user_profile() called
   ↓
5. Create public.workspaces (owner = new user)
   ↓
6. Create public.admin_access (user as admin of workspace)
   ↓
7. Create session with user_id = public.users.id
   ↓
8. Return success + redirect to dashboard
```

### Employee Invite Flow
```
1. Admin creates invite via /api/employees
   ↓
2. RPC rpc_create_employee_invite() validates admin access
   ↓
3. Generate secure token, store in employee_invites
   ↓
4. Send invite link with token to employee email
   ↓
5. Employee clicks link → /invite?token=<token>
   ↓
6. POST /api/employees/accept-invite?token=<token>
   ↓
7. Verify token, email, expiration
   ↓
8. Create auth.users (if not exists)
   ↓
9. Create/link public.users row
   ↓
10. Create public.employees record
    ↓
11. Update invite_status to 'accepted'
    ↓
12. Return success + redirect to dashboard
```

---

## 📚 Related Files

- `038_complete_signup_invite_flow_fix.sql` - The migration
- `MIGRATION_038_COMPLETE_SIGNUP_INVITE_FIX.md` - Detailed guide
- `verify_migration_038.sh` - Verification script
- `INTERNAL_USER_ID_CONTRACT.md` - User ID strategy
- `SUPER_ADMIN_ROLE_CREATION_FIX.md` - Super admin setup

---

**Last Updated**: January 22, 2026  
**Status**: Ready for Deployment  
**Estimated Time**: 5 minutes  
**Risk Level**: Low (additive changes, no data loss)
