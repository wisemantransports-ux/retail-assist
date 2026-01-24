# Quick Start: Run Migration 038

## In 3 Steps

### Step 1: Back Up Database (1 minute)
Go to **Supabase Dashboard** → **Database** → **Backups** → **Create backup**

### Step 2: Run Migration (1 minute)
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy & paste entire content of: `supabase/migrations/038_comprehensive_schema_fix.sql`
4. Click **Run**
5. Wait for completion (should show "Query successful" or similar)

### Step 3: Verify (2 minutes)
Run this single verification query:

```sql
-- Verify the 3 critical fixes
SELECT 
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'users' AND column_name = 'role') as has_role_column,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'employees' AND column_name = 'workspace_id') as has_workspace_id,
  (SELECT COUNT(*) FROM public.admin_access) as admin_access_rows;
```

**Expected result:** `3 | 1 | ≥1`
- `3`: role column exists
- `1`: workspace_id column exists  
- `≥1`: admin_access has data

✅ **Done! Migration is applied.**

---

## Test It Works

### Test Signup
1. Go to `/auth/signup`
2. Sign up with new email
3. Should redirect to dashboard with workspace

### Test Invite
1. Sign in as admin
2. Go to Employees
3. Send invite to another email
4. Open invite link in private browser
5. Accept invite
6. Should work and create new account

---

## If Something Goes Wrong

**Restore from backup:**
1. Go to Supabase Dashboard → Database → Backups
2. Find backup from before migration
3. Click restore
4. Wait 5 minutes

See `MIGRATION_038_GUIDE.md` for detailed troubleshooting.

---

## What Was Fixed

| Issue | Impact | Fixed In |
|-------|--------|----------|
| No `role` column on users | Super admin checks fail | Section 1 |
| Employees uses `business_id` | Accept invite fails | Section 2 |
| Employees missing `role`, `full_name` | Employee creation fails | Section 2 |
| No auth trigger | Signup RPC fails | Section 4 |
| Workspace owners not in admin_access | Invite creation fails | Section 9 |
| Bad RLS policies | Cross-workspace data leaks | Section 6-13 |

---

## File Locations

- **Migration**: `supabase/migrations/038_comprehensive_schema_fix.sql`
- **Full Guide**: `MIGRATION_038_GUIDE.md`
- **Audit Report**: `SCHEMA_AUDIT_REPORT.md`

---

## Questions?

1. Read `SCHEMA_AUDIT_REPORT.md` for what was wrong
2. Read `MIGRATION_038_GUIDE.md` for detailed steps & troubleshooting
3. Check verification queries in both files

**Go to Supabase Dashboard → SQL Editor → Run migration!** 🚀
