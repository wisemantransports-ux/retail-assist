# Client-Admin Invitation Flow - Quick Testing Guide

## Quick Start (5 minutes)

### Setup
```bash
# 1. Start dev server
npm run dev

# 2. Open browser
open http://localhost:3000
```

### Test Steps

**1. Login as Client-Admin**
- Go to `/login`
- Enter client-admin credentials
- Should redirect to workspace dashboard

**2. Create an Invite**
- Go to `/dashboard/{workspace_id}/employees`
- Click "Invite Team Members"
- Enter test email: `invite-test@example.com`
- Click "Send Invite"
- You should see the invite in "Pending Invites" table
- Copy the invite link to clipboard (Copy Link button)

**3. Accept the Invite**
- Open new incognito window
- Paste the invite link: `http://localhost:3000/invite?token=ABC...`
- You should see the invite acceptance form
- Fill in:
  - Email: `invite-test@example.com`
  - First Name: `Test`
  - Last Name: `User`
- Click "Accept Invitation"
- Should redirect to employee dashboard

**4. Verify Success**
- Switch back to admin window
- Refresh `/dashboard/{workspace_id}/employees`
- Should see "Test User" in employees list

---

## Test Scenarios

### ✅ Happy Path
```
1. Admin invites employee with email
2. Employee opens invite link
3. Employee fills form (email, first name, last name)
4. Employee accepts invite
5. Employee is redirected to workspace dashboard
6. Employee appears in admin's employees list
```

### ❌ Invalid Token
```
URL: http://localhost:3000/invite?token=invalid123
Expected: Toast error "Invalid or expired invite token"
```

### ❌ Missing Token
```
URL: http://localhost:3000/invite
Expected: Toast error "Invalid invitation link. Token is missing." + redirect
```

### ❌ Email Mismatch
```
1. Invite email: alice@example.com
2. Accept form email: bob@example.com
3. Expected: Toast error "Email does not match the invitation"
```

### ❌ Already Accepted
```
1. Accept invite successfully
2. Try same token again
3. Expected: Toast error "This invite has already been accepted"
```

### ❌ Expired Invite
```
1. Database: UPDATE employee_invites SET expires_at = now() - interval '1 day' WHERE token = '...'
2. Try to accept
3. Expected: Toast error "This invite has expired"
```

---

## Browser DevTools Checks

### Network Tab
- `POST /api/employees/accept-invite` should return **200 OK**
- Response should include `workspace_id` and `role`

### Application Tab
- Cookies should be set for authenticated session
- Local storage may contain workspace info

### Console Tab
- No console errors
- Server logs show: `[/api/employees/accept-invite POST] User {user_id} accepted invite to workspace {workspace_id}`

---

## Database Verification

### Check Invite Created
```sql
SELECT id, token, email, status, expires_at 
FROM employee_invites 
WHERE email = 'invite-test@example.com'
LIMIT 1;
```

### Check Employee Created
```sql
SELECT id, user_id, workspace_id, role, full_name 
FROM employees 
WHERE full_name LIKE 'Test%'
LIMIT 1;
```

### Check Invite Updated
```sql
SELECT id, token, status, accepted_at 
FROM employee_invites 
WHERE token = 'TOKEN_HERE';
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Invalid or expired invite token" | Token doesn't exist or expired | Check token in URL, create new invite |
| "Email does not match the invitation" | Email case mismatch or typo | Carefully enter exact email |
| "Inviter does not have access to this workspace" | Inviter no longer admin | Verify inviter is still admin in workspace |
| Redirect to `/` instead of dashboard | workspace_id missing from response | Check API response, verify backend success |
| Redirect loop on `/invite` | Missing token param | Check invite link URL has `?token=...` |

---

## Performance Tips

- First load: ~2-3 seconds (includes page hydration)
- Form submission: ~500-800ms (API call + DB operation)
- Success redirect: Instant (client-side navigation)

---

## What to Report if Issues Occur

1. **Screenshot of error message**
2. **Browser console logs** (copy/paste)
3. **Server logs** (from `npm run dev`)
4. **Steps to reproduce**
5. **API response** (from Network tab)
6. **Database state** (affected records)

---

## Success Criteria

✅ Invite created successfully  
✅ Copy link button works  
✅ Accept form displays correctly  
✅ Form validation works  
✅ Backend accepts invite  
✅ Employee appears in list  
✅ Redirect to workspace dashboard  
✅ No console errors  
✅ API returns correct response  
✅ Database records updated  

---

**Ready to test!** 🚀
