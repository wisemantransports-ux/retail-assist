# Quick Start - Deploy & Test Invite Signup Flow

## 🚀 Deploy to Vercel (30 seconds)

```bash
git add .
git commit -m "Complete invite signup flow - ready for testing"
git push origin main
```

Then go to https://vercel.com/dashboard and wait for deployment to complete.

---

## 🧪 Test Sequence (5 minutes)

### Test 1: Create Invite

1. Go to your app: https://retail-assist.vercel.app (or local: http://localhost:3000)
2. Login as admin
3. Navigate to: Dashboard → Employees → "Invite Employee"
4. Enter test email: **your-email@gmail.com** (use a REAL email you have access to!)
5. Click "Send Invite"
6. **Copy the invite link** from the modal that appears
   ```
   Example: https://retail-assist.vercel.app/invite?token=abc123def456...
   ```

**Check logs:**
```bash
vercel logs --follow
```
Look for:
```
[/api/employees/invite POST] Invite created with token: { token_length: 32 }
```

---

### Test 2: Watch the Database

In Supabase SQL Editor, run:
```sql
SELECT token, email, status, created_at, expires_at
FROM employee_invites
WHERE email = 'your-email@gmail.com'
ORDER BY created_at DESC
LIMIT 1;
```

You should see:
- token: 32 character hex string
- status: 'pending'
- email: your-email@gmail.com
- expires_at: 30 days from now

---

### Test 3: Accept Invite

1. **Open a NEW private/incognito window** (important!)
2. **Paste the invite link** you copied
3. You should see the invite signup form
4. Open DevTools: F12 → Console tab
5. Fill in the form:
   - Email: **your-email@gmail.com** (SAME as invite!)
   - First Name: Test
   - Last Name: User
6. Click "Accept Invitation"

**Watch console for:**
```
[InviteForm] Token from URL: { token: "abc..." }
[InviteForm] Response status: 200
[InviteForm] Invite accepted successfully
[InviteForm] Redirecting to: /dashboard/.../employees
```

---

### Test 4: Verify Success

After redirect, you should see:
- ✅ Employee dashboard loads
- ✅ No console errors (F12 → Console)
- ✅ Toast showed: "Invite accepted!"
- ✅ URL changed to: `/dashboard/{workspace_id}/employees`

**Verify database:**
```sql
SELECT status, accepted_at FROM employee_invites
WHERE email = 'your-email@gmail.com'
LIMIT 1;
```

Should show:
- status: 'accepted'
- accepted_at: current time

---

### Test 5: Error Scenarios (Optional)

**Try with wrong email:**
1. Use same invite link
2. Enter DIFFERENT email (e.g., other@gmail.com)
3. Should see error: "Email does not match the invitation"

**Try expired invite:**
1. Create another invite
2. Wait or manually expire it in database:
   ```sql
   UPDATE employee_invites
   SET expires_at = now() - interval '1 day'
   WHERE email = 'test@gmail.com';
   ```
3. Try to accept
4. Should see error: "This invite has expired"

---

## 📊 Success Checklist

After testing, verify:

- [ ] Invite created with 32-char token
- [ ] Token stored in database
- [ ] Invite link works in private window
- [ ] Form displays correctly
- [ ] Console shows token extracted
- [ ] Can submit form
- [ ] Backend validates token
- [ ] Redirects to employees page
- [ ] No console errors
- [ ] Toast shows success
- [ ] Database shows 'accepted' status
- [ ] Error scenarios work

If all checked: ✅ **The flow works perfectly!**

---

## 🔍 If Something Fails

**Check 1: Frontend Logs**
```bash
# Open DevTools (F12) → Console tab
# Look for [InviteForm] logs
# Copy the full log output
```

**Check 2: Backend Logs**
```bash
vercel logs --follow
# Look for [/api/employees...] logs
# Copy the error message
```

**Check 3: Database**
```sql
-- Check if token exists
SELECT COUNT(*) FROM employee_invites WHERE status = 'pending';

-- Check the specific invite
SELECT * FROM employee_invites
WHERE email = 'your-email@gmail.com'
ORDER BY created_at DESC LIMIT 1;
```

**Check 4: Compare Tokens**
- Browser console shows: `token: "abc123..."`
- Vercel logs show: `token_received: "abc123..."`
- Should match exactly!

---

## 📝 Log Examples

### Success Flow Logs

**Browser Console:**
```
[InviteForm] Token extracted from URL: { token: "3f8a7b9c2d1e4f6a1b2c3d4e5f6a7b8c", token_length: 32, contains_percent: false, contains_plus: false, contains_space: false }
[InviteForm] Token from URL: { token: "3f8a...", token_length: 32, param_name: "token" }
[InviteForm] Submitting invite acceptance: { token: "3f8a...", email: "test@gmail.com", first_name: "Test" }
[InviteForm] Request sent with token: { token_sent: "3f8a7b9c2d1e4f6a1b2c3d4e5f6a7b8c", token_length: 32, token_preview: "3f8a7b9c2d1e4f6a" }
[InviteForm] Response status: 200
[InviteForm] Response content-type: application/json
[InviteForm] Response body length: 123
[InviteForm] Response body: {"success":true,"workspace_id":"5fa8e5c2-1b2e-4f3a-9c1d-2e3f4a5b6c7d","role":"employee"}
[InviteForm] Parsed response: {success: true, workspace_id: "...", role: "employee"}
[InviteForm] Invite accepted successfully: {workspaceId: "5fa8e5c2-1b2e-4f3a-9c1d-2e3f4a5b6c7d", role: "employee"}
[InviteForm] Redirecting to: /dashboard/5fa8e5c2-1b2e-4f3a-9c1d-2e3f4a5b6c7d/employees
```

**Vercel Logs:**
```
[/api/employees/invite POST] Calling RPC to create invite: { p_email: "test@gmail.com", p_role: "employee", p_workspace_id: "5fa8e5c2-1b2e-4f3a-9c1d-2e3f4a5b6c7d", p_invited_by: "user-id" }
[/api/employees/invite POST] RPC response: { error: null, data_length: 1, first_row: { invite_id: "invite-uuid", token: "3f8a7b9c2d1e4f6a1b2c3d4e5f6a7b8c" } }
[/api/employees/invite POST] Invite created with token: { invite_id: "invite-uuid", token: "3f8a...", token_length: 32 }
[/api/employees/accept-invite POST] Looking up invite with token: { token_received: "3f8a7b9c2d1e4f6a1b2c3d4e5f6a7b8c", token_length: 32, token_preview: "3f8a7b9c2d1e4f6a", token_type: "string" }
[/api/employees/accept-invite POST] Invite found: { invite_id: "...", token_match: true, db_token_preview: "3f8a7b9c2d1e4f6a", request_token_preview: "3f8a7b9c2d1e4f6a", email: "test@gmail.com", status: "pending" }
[/api/employees/accept-invite POST] User user-id accepted invite to workspace 5fa8e5c2-1b2e-4f3a-9c1d-2e3f4a5b6c7d
[/api/employees/accept-invite POST] Sending success response: { success: true, workspace_id: "5fa8e5c2-1b2e-4f3a-9c1d-2e3f4a5b6c7d", role: "employee" }
```

---

## ⏱️ Timing

- Create invite: 2 seconds
- Copy link: 5 seconds
- Open link and fill form: 1 minute
- Submit and test: 30 seconds
- **Total: ~2 minutes per test**

Do at least 2 full tests to be confident.

---

## 🎯 Final Check

Before saying it's done, verify:

```bash
# 1. Build passes
npm run build

# 2. Code is committed
git status

# 3. Deployed to Vercel
vercel --version

# 4. Test invite flow works
# (run Test Sequence above)

# 5. Check logs
vercel logs | grep "accept-invite"
```

If all pass: ✅ **You're done!**

---

## 💬 Notes

- Use a REAL email for testing (gmail, outlook, etc.)
- Always test in a **private/incognito window**
- Token should be 32 hexadecimal characters
- Email must match exactly (case-insensitive, but exact)
- Each token can only be used once
- Tokens expire after 30 days

---

**Good luck! The implementation is solid - just test and deploy! 🚀**
