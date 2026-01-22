# Quick Deployment & Testing Guide

## 🚀 Deploy in 2 Minutes

### Step 1: Apply Database Changes
```bash
cd /workspaces/retail-assist
supabase db push
```

This adds the `full_name` column to `employee_invites` table (migration 033).

### Step 2: Deploy to Vercel
```bash
git add .
git commit -m "Fix invite acceptance flow - add auth, password, full_name"
git push origin main
```

Monitor the Vercel build:
- Expected build time: 16-17s
- Check for green checkmark ✓ Compiled successfully

### Step 3: Verify Environment
Ensure Vercel has these variables set:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  ← Required for auth creation
```

---

## ✅ Quick Test (5 minutes)

### Test Setup
1. Open admin dashboard
2. Navigate to Employees section
3. Create new invite for `testuser@example.com`
4. Copy the invite link (should show `/invite?token=xxxxx`)

### Test Happy Path
```
1. Open link in PRIVATE/INCOGNITO window
   (prevents auth cache conflicts)

2. Fill form:
   Email: testuser@example.com
   First Name: Test
   Last Name: User
   Password: TestPass123!

3. Click "Accept Invitation"

4. Verify:
   ✓ Loading spinner appears
   ✓ Success toast: "Invite accepted! Redirecting..."
   ✓ Redirected to /dashboard/{workspace_id}/employees
   ✓ Employee "Test User" appears in list
```

### Test Error Scenarios

**Wrong Email:**
```
1. Accept invite with different email: other@example.com
2. Should show: "Email does not match the invitation"
```

**Invalid Token:**
```
1. Open: /invite?token=fakefakefake
2. Should show: "Invalid or expired invite token"
```

**Weak Password:**
```
1. Try password with 5 characters
2. Should show: "Password must be at least 6 characters"
```

---

## 🔍 Verify Database Changes

### Check Migration Applied
```sql
-- In Supabase SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employee_invites'
ORDER BY ordinal_position;

-- Should show: full_name | text
```

### Check Invite After Acceptance
```sql
SELECT 
  id,
  email,
  status,
  full_name,
  accepted_at,
  created_at
FROM public.employee_invites
WHERE email = 'testuser@example.com'
ORDER BY created_at DESC
LIMIT 1;

-- Should show:
-- status: accepted
-- full_name: Test User
-- accepted_at: 2026-01-21 12:34:56+00
```

### Check User Account Created
```sql
SELECT 
  id,
  email,
  full_name,
  auth_uid,
  created_at
FROM public.users
WHERE email = 'testuser@example.com'
LIMIT 1;

-- Should show:
-- email: testuser@example.com
-- full_name: Test User
-- auth_uid: (UUID from Supabase Auth)
```

### Check Employee Record Created
```sql
SELECT 
  id,
  user_id,
  workspace_id,
  full_name,
  created_at
FROM public.employees
WHERE user_id = (SELECT id FROM public.users WHERE email = 'testuser@example.com')
LIMIT 1;

-- Should show the employee linked to workspace
```

---

## 🔐 Test Login with New Account

### Verify Auth Account Works
```
1. Go to /login page
2. Enter: testuser@example.com
3. Enter: TestPass123!
4. Click Login
5. Should redirect to dashboard
6. Verify user is logged in
```

---

## 📊 Monitoring

### Check Vercel Logs
1. Go to Vercel Dashboard → your-project → Deployments
2. Click latest deployment
3. Check "Logs" tab for:
   ```
   ✓ No "error" or "Error" messages
   ✓ Build shows: Compiled successfully
   ✓ No TypeScript errors
   ✓ No import errors
   ```

### Check Server Console
During invite acceptance, backend should log:
```
[/api/employees/accept-invite POST] Accepting invite: {token: "a1b2c3...", ...}
[/api/employees/accept-invite POST] Invite found: {invite_id: "...", token_match: true, ...}
[/api/employees/accept-invite POST] Created auth account and user profile: {...}
[/api/employees/accept-invite POST] Sending success response: {success: true, workspace_id: "..."}
```

---

## ⚠️ Troubleshooting

### Issue: "Service Role Key Not Found"
**Error:** "Failed to create account"

**Fix:**
```
1. Go to Supabase Dashboard → Project Settings → API
2. Copy "Service Role Key" (not anon key!)
3. Set as SUPABASE_SERVICE_ROLE_KEY in Vercel
4. Redeploy
```

### Issue: "Unexpected end of JSON input"
**Error:** Console error from frontend

**Fix:**
```
1. Backend not returning valid JSON
2. Check Vercel logs for 500 errors
3. Verify all error responses use NextResponse.json()
4. Restart deployment
```

### Issue: Redirect Not Working
**Error:** Accept form works but no redirect to dashboard

**Fix:**
```
1. Check workspace_id in response: /api/employees/accept-invite in Vercel logs
2. Verify /dashboard/{workspace_id}/employees page exists
3. Check browser console for JavaScript errors
4. Try different browser/private window
```

### Issue: "Already Used" After First Try
**Error:** Trying to accept same token twice fails correctly on 2nd attempt

**This is expected!** Once accepted, the invite status is 'accepted' and cannot be used again.

---

## 📋 Post-Deployment Checklist

- [ ] Vercel deployment successful (green check)
- [ ] Database migration applied (supabase db push completed)
- [ ] Service role key set in Vercel environment
- [ ] Test user created invite link shows `/invite?token=`
- [ ] Accept form has password field
- [ ] Accept form accepts and redirects successfully
- [ ] Employee appears in workspace after acceptance
- [ ] Database shows status='accepted' and full_name set
- [ ] Login works with created account (email + password)
- [ ] Error scenarios show correct messages
- [ ] No console errors or warnings

---

## 🎯 Success Criteria

✓ Invite link format: `/invite?token=abc123` (query param, not path)  
✓ Form has password field (minimum 6 chars)  
✓ Accept form validates all fields  
✓ Backend creates auth account during acceptance  
✓ Backend creates user profile with auth_uid  
✓ Backend creates employee record in workspace  
✓ Backend stores full_name in invite record  
✓ Backend updates invite status to 'accepted'  
✓ Response includes workspace_id for redirect  
✓ Frontend redirects to `/dashboard/{workspace_id}/employees`  
✓ All responses are valid JSON (no parse errors)  
✓ Error messages are descriptive and helpful  
✓ Loading indicators shown during submission  
✓ Success toast shown before redirect  

---

## 🚨 Rollback Plan

If issues occur:

```bash
# 1. Revert code changes
git revert HEAD
git push origin main

# 2. Wait for Vercel to rebuild

# 3. If database issues, backup and drop the migration
# (Keep data if possible)
supabase db reset  # If needed

# Then contact dev team for fix
```

---

**Deploy with confidence! ✨**

Build Status: ✓ Compiled successfully in 16.4s  
Last Updated: January 21, 2026
