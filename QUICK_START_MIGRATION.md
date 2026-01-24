# Quick Start: Deploy Signup & Invite Migration

## TL;DR - Get It Working in 5 Minutes

### Step 1: Run the Migration

**Via Supabase Dashboard (easiest)**:
1. Go to [dashboard.supabase.com](https://dashboard.supabase.com)
2. Select your project
3. Click **SQL Editor** → **New Query**
4. Copy contents of `/supabase/migrations/038_comprehensive_signup_invite_flow_migration.sql`
5. Paste into editor
6. Click **Run**
7. Wait for ✅ success message

**Via CLI**:
```bash
supabase db push
```

### Step 2: Verify It Worked

Run this in Supabase SQL Editor:

```sql
-- Check users table has all columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('role', 'business_name', 'phone', 'plan_type')
ORDER BY column_name;
```

Expected result: 4 rows (`phone`, `plan_type`, `role`, `business_name`)

```sql
-- Test RPC works
SELECT * FROM public.rpc_get_user_access() LIMIT 1;
```

Should return without error (even if no rows for unauthenticated user).

### Step 3: Test Signup Flow

1. Go to [your-app.com/auth/signup](http://localhost:3000/auth/signup)
2. Fill form:
   - Business: "Test Co"
   - Email: `test-admin-DATE@example.com` (use unique email)
   - Phone: `+1234567890`
   - Password: `TestPass123!`
3. Click Sign Up
4. ✅ Should redirect to dashboard

### Step 4: Test Invite Flow

1. Login with the account from Step 3
2. Go to dashboard → Employees
3. Click "Invite Employee"
4. Fill form:
   - Email: `test-employee-DATE@example.com`
5. Click Invite
6. Copy the invite link from console or email
7. Open link in **incognito window** (unauthenticated)
8. Fill form:
   - Email: same as invite
   - First Name: "John"
   - Password: `EmpPass123!`
9. Click Accept
10. ✅ Should redirect to employee dashboard

---

## What Was Fixed

| Issue | Before | After |
|-------|--------|-------|
| Missing `users.role` column | Signup fails | ✅ Works |
| Missing `users.business_name` | Signup fails | ✅ Works |
| Missing `users.phone` | Signup fails | ✅ Works |
| Missing `users.plan_type` | Signup fails | ✅ Works |
| Missing `employees.full_name` | Invite fails | ✅ Works |
| Missing `employees.phone` | Invite fails | ✅ Works |
| Broken `rpc_get_user_access` | Role check fails | ✅ Works |
| Broken RLS policies | Permissions denied | ✅ Works |

---

## Troubleshooting

### Sign up fails with "business_name" error
→ Migration didn't apply. Check SQL Editor for error message.

### Invite acceptance fails with "full_name" error  
→ Migration didn't complete. Re-run migration.

### Role-based redirect fails after signup
→ `rpc_get_user_access` not working. Check it returns rows:
```sql
SELECT * FROM public.rpc_get_user_access();
```

### RLS permission denied errors
→ Run verification query:
```sql
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'admin_access';
```

Should show `rowsecurity = true`.

---

## Files Modified by Migration

- ✅ `users` table - Added 4 columns
- ✅ `admin_access` table - Fixed RLS policies
- ✅ `employees` table - Added 2 columns
- ✅ `employee_invites` table - Ensured schema correct
- ✅ `rpc_create_user_profile` - Fixed INSERT statements
- ✅ `rpc_get_user_access` - Fixed column references
- ✅ `rpc_accept_employee_invite` - Fixed INSERT statements

---

## Next Steps

1. ✅ Test signup (admin account)
2. ✅ Test invite (employee account)
3. ✅ Verify multi-account support (create 2nd admin)
4. ✅ Run data checks (see guide for queries)
5. ✅ Deploy to production

---

## Rollback (if needed)

```bash
# Option 1: Restore from backup
psql postgresql://[connection-string] < backup_before_038.sql

# Option 2: Manual - drop new columns
ALTER TABLE public.users DROP COLUMN IF EXISTS role CASCADE;
ALTER TABLE public.users DROP COLUMN IF EXISTS business_name CASCADE;
ALTER TABLE public.users DROP COLUMN IF EXISTS phone CASCADE;
ALTER TABLE public.users DROP COLUMN IF EXISTS plan_type CASCADE;
```

---

## Need Help?

See detailed guide: [SIGNUP_INVITE_MIGRATION_GUIDE.md](SIGNUP_INVITE_MIGRATION_GUIDE.md)

See audit report: [FRONTEND_DATABASE_ALIGNMENT_AUDIT.md](FRONTEND_DATABASE_ALIGNMENT_AUDIT.md)
