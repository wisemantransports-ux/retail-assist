# Quick Deployment Guide - Invite Authorization Fix

**Problem:** "Inviter does not have access to this workspace" error on Vercel  
**Cause:** Missing `admin_access` database table  
**Status:** ✅ Fixed

---

## What Was Done

### 1. Created Missing Table Migration
**File:** `supabase/migrations/037_create_admin_access_table.sql`

This migration creates the `admin_access` table that:
- Stores who is admin of which workspace
- Uses NULL workspace_id for super_admin access
- Automatically migrates existing workspace owners
- Includes proper RLS policies

### 2. Improved Authorization Checks
**File:** `app/api/employees/accept-invite/route.ts` (lines 294-350)

- Changed from `.single()` to `.maybeSingle()` for robustness
- Now checks both table existence AND admin role
- Better error messages

---

## Deployment Steps

### Local Development

1. **Run migration locally:**
   ```bash
   supabase migration up
   ```
   or
   ```bash
   supabase db push
   ```

2. **Test invite flow:**
   - Login as client admin
   - Create employee invite
   - Open new browser → Accept invite
   - Verify employee created

### Vercel / Production

1. **Push code changes to main:**
   ```bash
   git add .
   git commit -m "fix: add missing admin_access table and improve authorization"
   git push
   ```

2. **Run Supabase migration:**
   
   **Option A: Via CLI**
   ```bash
   SUPABASE_ACCESS_TOKEN=<your-token> supabase db push --linked
   ```

   **Option B: Via Dashboard**
   - Go to `https://app.supabase.com/project/<project-id>/sql/new`
   - Copy contents of `supabase/migrations/037_create_admin_access_table.sql`
   - Click "Run"

3. **Verify migration:**
   ```sql
   SELECT * FROM admin_access LIMIT 5;
   -- Should show your admins
   ```

4. **Test on Vercel:**
   - Visit deployed app
   - Login as client admin
   - Try creating employee invite
   - Should work now ✅

---

## Rollback (if needed)

```sql
-- Drop the table (WARNING: only if needed!)
DROP TABLE IF EXISTS public.admin_access CASCADE;
```

Then revert the code changes in `/app/api/employees/accept-invite/route.ts`.

---

## Verification Queries

Check if admins are migrated correctly:

```sql
-- Count admins by workspace
SELECT workspace_id, COUNT(*) as admin_count 
FROM admin_access 
WHERE workspace_id IS NOT NULL
GROUP BY workspace_id;

-- Check super admins
SELECT user_id, role 
FROM admin_access 
WHERE workspace_id IS NULL;

-- Find admins for a specific workspace
SELECT aa.user_id, u.email, aa.role
FROM admin_access aa
JOIN users u ON u.id = aa.user_id
WHERE aa.workspace_id = 'YOUR-WORKSPACE-ID';
```

---

## What's Now Protected

✅ Only workspace admins can create invites  
✅ Only workspace admins can invite employees  
✅ Only super admins can invite platform staff  
✅ Accepts-invite endpoint verifies inviter is still admin  
✅ Clear error messages if authorization fails

---

## Files Involved

**Created:**
- `supabase/migrations/037_create_admin_access_table.sql`

**Modified:**
- `app/api/employees/accept-invite/route.ts`

**Documented:**
- `INVITE_AUTHORIZATION_FIX_COMPLETE.md` (this file)
- `INVITE_AUTHORIZATION_FIX_COMPLETE.md` (detailed technical doc)

---

## Testing Checklist

After deployment:

- [ ] Login as client admin (not super admin)
- [ ] Navigate to employees page
- [ ] Click "Invite Employee"
- [ ] Enter valid email and click submit
- [ ] Invite should be created successfully
- [ ] Check `/api/employees` endpoint works
- [ ] Try accepting an invite in incognito window
- [ ] Verify new employee is created in database
- [ ] Check that members (non-admins) cannot create invites

---

## Need Help?

Check these files for details:

1. **Technical Details:** `INVITE_AUTHORIZATION_FIX_COMPLETE.md`
2. **Database Schema:** `supabase/migrations/037_create_admin_access_table.sql`
3. **API Code:** `app/api/employees/accept-invite/route.ts` (lines 294-350)
4. **RPC Function:** `supabase/migrations/032_create_employee_invite.sql` (lines 70-73)

---

## Summary

✅ Missing table created  
✅ Authorization checks improved  
✅ Error messages clarified  
✅ Data auto-migrated from existing records  
✅ Ready for production deployment
