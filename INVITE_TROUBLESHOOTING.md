# Quick Troubleshooting Checklist

## ✅ Step 1: Verify Build
```bash
npm run build
```
Expected: "✓ Compiled successfully"

---

## ✅ Step 2: Test Token Generation

When you create an invite, check console logs:

**Vercel logs should show:**
```
[/api/employees/invite POST] Calling RPC to create invite: {
  p_email: "test@example.com",
  p_role: "employee",
  p_workspace_id: "uuid",
  p_invited_by: "admin-id"
}

[/api/employees/invite POST] RPC response: {
  error: null,
  data_length: 1,
  first_row: {
    invite_id: "uuid",
    token: "abc123def456..." 
  }
}

[/api/employees/invite POST] Invite created with token: {
  token_length: 32
}
```

✅ **If you see this:** Token is being created correctly
❌ **If error is not null:** RPC failed - check logs for error message

---

## ✅ Step 3: Verify Database

After creating invite, run in Supabase SQL:

```sql
SELECT id, token, email, status, created_at, expires_at
FROM employee_invites
WHERE email = 'test@example.com'
ORDER BY created_at DESC
LIMIT 1;
```

✅ **Should see:**
- token: 32-character hex string
- status: 'pending'
- email: matches exactly
- expires_at: future date

❌ **If no rows:** Token wasn't saved to database

---

## ✅ Step 4: Verify Token Format

Copy token from database and check:

```bash
# Token should be 32 chars (16 bytes × 2 hex per byte)
echo "abc123def456..." | wc -c
# Should output: 33 (32 chars + newline)

# Token should be lowercase hex only
echo "abc123def456..." | grep -E '^[0-9a-f]{32}$'
# Should match
```

---

## ✅ Step 5: Accept Invite Test

**Browser console should show:**

```
[InviteForm] Token extracted from URL: {
  token: "abc123def456...",
  token_length: 32
}

[InviteForm] Submitting invite acceptance: {
  email: "test@example.com",
  first_name: "Test"
}

[InviteForm] Response status: 200

[InviteForm] Parsed response: {
  success: true,
  workspace_id: "uuid",
  role: "employee"
}
```

**Vercel logs should show:**

```
[/api/employees/accept-invite POST] Looking up invite with token: {
  token_received: "abc123def456...",
  token_length: 32
}

[/api/employees/accept-invite POST] Invite found: {
  token_match: true,
  email: "test@example.com",
  status: "pending"
}

[/api/employees/accept-invite POST] User ... accepted invite to workspace ...
```

✅ **If you see this:** Complete flow worked!

---

## ❌ Common Errors & Solutions

### Error: "Invalid or expired invite token"

**Cause 1: Token doesn't exist in database**
```bash
# Check database
SELECT COUNT(*) FROM employee_invites WHERE status = 'pending';
```
If 0: No invites created - check RPC error

**Cause 2: Token is corrupted/truncated**
```bash
# Compare:
DB Token:       abc123def456...  (32 chars)
Request Token:  abc123           (8 chars)
```
If different: Token is being truncated - check frontend logging

**Cause 3: Wrong Supabase environment**
- Local dev: Using local Supabase
- Vercel: Using production Supabase
Check .env files

---

### Error: "Email does not match the invitation"

**Cause 1: Case sensitivity**
```sql
-- Check database:
SELECT email FROM employee_invites LIMIT 1;
-- Returns: "Test@Example.com"

-- Form sent: "test@example.com"
-- Match happens but case differs - should still work (we use LOWER())
```

**Cause 2: Typo in email**
- Invite created for: john@example.com
- Form submitted: jon@example.com (missing 'h')

**Solution:** Copy email from invite link if possible

---

### Error: "User is already an employee"

**Cause:** Same user already accepted another invite to same workspace

**Solution:** Don't reuse same email for new invites in same workspace

---

### Redirect fails / stays on form

**Cause 1: No workspace_id in response**
```bash
# Check backend:
[/api/employees/accept-invite POST] Sending success response: {
  success: true,
  workspace_id: null,  # ← Problem!
  role: "employee"
}
```

**Solution:** Check that invite has valid workspace_id

**Cause 2: Redirect URL invalid**
```bash
# Check console:
[InviteForm] Redirecting to: /dashboard/invalid-id/employees
```

**Solution:** Verify workspace_id is a valid UUID

---

## 📊 Database Query Reference

**Check all pending invites:**
```sql
SELECT id, token, email, status, created_at, expires_at
FROM employee_invites
WHERE status = 'pending'
AND expires_at > now()
ORDER BY created_at DESC;
```

**Find invite by token:**
```sql
SELECT * FROM employee_invites
WHERE token = 'abc123def456...';
```

**Find invite by email:**
```sql
SELECT * FROM employee_invites
WHERE email = 'test@example.com'
ORDER BY created_at DESC;
```

**Count pending invites:**
```sql
SELECT COUNT(*) FROM employee_invites WHERE status = 'pending';
```

**Mark invite as used (manual):**
```sql
UPDATE employee_invites
SET status = 'accepted', accepted_at = now()
WHERE token = 'abc123def456...';
```

**Reset invite status (for testing):**
```sql
UPDATE employee_invites
SET status = 'pending', accepted_at = NULL
WHERE token = 'abc123def456...';
```

---

## 🔍 Log Monitoring

**Watch Vercel logs in real-time:**
```bash
vercel logs --follow
```

**Search for specific logs:**
```bash
vercel logs | grep "accept-invite"
```

**Get last 50 lines:**
```bash
vercel logs | tail -50
```

---

## ✅ Successful Flow Indicators

All of these should be visible:

1. ✅ Invite created: `[/api/employees/invite POST] Invite created with token`
2. ✅ Token in DB: Database query shows token exists
3. ✅ Token lookup succeeds: `[/api/employees/accept-invite POST] Invite found`
4. ✅ User created: Employee record appears in database
5. ✅ Redirect works: Browser navigates to /dashboard/.../employees
6. ✅ No console errors: DevTools console is clean

---

## 🎯 Final Check

Run this checklist before saying it's working:

- [ ] Create invite as admin
- [ ] Copy invite link
- [ ] Open in private window
- [ ] Browser console shows token extracted
- [ ] Fill form with correct email
- [ ] Submit
- [ ] Browser console shows 200 response
- [ ] Redirected to employees dashboard
- [ ] No toast errors
- [ ] Database shows invite with status 'accepted'
- [ ] New employee appears in list
- [ ] Vercel logs show complete flow
- [ ] Try creating another invite and test again

If all ✅, the invite flow is working perfectly!
