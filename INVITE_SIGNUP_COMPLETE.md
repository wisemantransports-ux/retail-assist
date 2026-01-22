# Complete Invite Signup Flow - Implementation & Testing Guide

## ✅ Current Implementation Status

### Frontend (`/app/invite/invite-form.tsx`)
- ✅ Extracts token from URL (`?token=` or `?invite=`)
- ✅ Safe JSON parsing with try-catch
- ✅ Validates form inputs (email, first name)
- ✅ Sends token to backend
- ✅ Redirects to `/dashboard/{workspace_id}/employees` on success
- ✅ Shows descriptive error toast on failure
- ✅ Comprehensive logging for debugging

### Backend (`/api/employees/accept-invite`)
- ✅ Accepts token from request body
- ✅ Validates token exists and is pending
- ✅ Validates email matches
- ✅ Creates or gets user profile
- ✅ Creates employee record in workspace
- ✅ Marks invite as accepted
- ✅ Returns `{success: true, workspace_id, role}`
- ✅ Comprehensive error handling and logging

### Invite Creation (`/api/employees/invite`)
- ✅ Validates admin authorization
- ✅ Checks employee limits by plan
- ✅ Calls RPC to create invite
- ✅ Returns invite token to frontend
- ✅ Enhanced logging for debugging

---

## 🧪 Complete Testing Flow

### Test Scenario 1: Happy Path

**Step 1: Create an Invite**
```bash
1. Login as admin at https://localhost:3000 (or https://retail-assist.vercel.app)
2. Navigate to: Dashboard → Employees → "Invite Employee"
3. Enter: testuser@gmail.com
4. Click "Send Invite"
5. See confirmation modal with token
6. Copy the link (looks like: https://localhost:3000/invite?token=ABC123...)
```

**Expected:**
- Admin sees: "Invitation sent successfully!"
- Modal shows invite link with token
- Token is 32 characters (hex string)

**Step 2: Accept the Invite**
```bash
1. Open a NEW private/incognito window
2. Paste the invite link
3. You should see the invite form
4. Open DevTools (F12 → Console)
```

**Expected in console:**
```
[InviteForm] Token extracted from URL: { token: "abc123...", token_length: 32 }
```

```bash
4. Fill in the form:
   - Email: testuser@gmail.com (SAME AS INVITE)
   - First Name: Test
   - Last Name: User
5. Click "Accept Invitation"
```

**Expected in console:**
```
[InviteForm] Submitting invite acceptance: { token: "abc123...", email: "testuser@gmail.com" }
[InviteForm] Response status: 200
[InviteForm] Parsed response: {success: true, workspace_id: "...", role: "employee"}
[InviteForm] Invite accepted successfully: {workspaceId: "...", role: "employee"}
[InviteForm] Redirecting to: /dashboard/.../employees
```

```bash
6. Should redirect to employees page and see message:
   "Invite accepted! Redirecting to your workspace..."
```

**Expected result:**
- ✅ Redirected to `/dashboard/{workspace_id}/employees`
- ✅ No console errors
- ✅ Toast shows success message
- ✅ Can see employees dashboard

---

### Test Scenario 2: Invalid Token

```bash
1. Open: https://localhost:3000/invite?token=fake123invalid
2. Fill form
3. Submit
```

**Expected:**
- Toast shows: "Invalid or expired invite token"
- No redirect
- Console shows error

---

### Test Scenario 3: Email Mismatch

```bash
1. Create invite for: john@example.com
2. In form, use: jane@example.com
3. Submit
```

**Expected:**
- Toast shows: "Email does not match the invitation"
- No redirect

---

### Test Scenario 4: Already Accepted Invite

```bash
1. Accept an invite successfully
2. Try same invite link again
3. Refresh and submit
```

**Expected:**
- Toast shows: "This invite has already been accepted"
- No duplicate employee created

---

## 🔍 Debugging Checklist

### If Token Lookup Fails

**Check 1: Token in Database**
```sql
SELECT token, email, status, created_at 
FROM employee_invites 
WHERE email = 'testuser@gmail.com' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Should see:**
- Token: `abc123...` (32 hex characters)
- Status: `pending`
- Email: matches exactly

**If no results:** RPC didn't create invite - check admin permissions

---

**Check 2: RPC Response**

Monitor Vercel logs during invite creation:
```bash
vercel logs --follow
```

**Look for:**
```
[/api/employees/invite POST] Calling RPC to create invite: {...}
[/api/employees/invite POST] RPC response: { error: null, data_length: 1, first_row: {...} }
[/api/employees/invite POST] Invite created with token: { token_length: 32 }
```

**If `error` is not null:** RPC failed - check authorization

**If `data_length: 0`:** RPC didn't return any rows

---

**Check 3: Token Mismatch**

Backend will log during acceptance:
```
[/api/employees/accept-invite POST] Looking up invite: { token_received: "abc123...", token_length: 32 }
[/api/employees/accept-invite POST] Invite found: { token_match: true }
```

**If `token_match: false`:** Token is corrupted in transit

---

### If Redirect Fails

**Check 1: workspace_id in Response**
```
[InviteForm] Invite accepted successfully: { workspaceId: "...", role: "..." }
```

Both should be present.

**Check 2: Redirect URL**
```
[InviteForm] Redirecting to: /dashboard/3fa8e5c2-1b2e-4f3a-9c1d-2e3f4a5b6c7d/employees
```

Should be valid UUID and path.

---

## 📊 Complete Data Flow Diagram

```
INVITE CREATION:
┌─────────────────┐
│  Admin Creates  │
│  Invite         │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────┐
│ POST /api/employees/invite          │
│ Body: { email: "..." }              │
│ Auth: Admin (from cookies)          │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│ RPC: rpc_create_employee_invite     │
│ 1. Verify admin authorization       │
│ 2. Generate token (16 bytes → hex)  │
│ 3. Insert into employee_invites     │
│ 4. Return { invite_id, token }     │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────┐
│ Response: 201 Created               │
│ {                                   │
│   success: true,                    │
│   invite: {                         │
│     token: "32chartoken",           │
│     email: "test@example.com"       │
│   }                                 │
│ }                                   │
└────────┬────────────────────────────┘
         │
         ↓
┌─────────────────┐
│ Frontend Shows  │
│ Invite Link     │
│ ?token=32char   │
└─────────────────┘


INVITE ACCEPTANCE:
┌─────────────────────────────────────┐
│ User Clicks Link & Sees Form        │
│ URL: /invite?token=32chartoken      │
└────────┬────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ Frontend: Extract token from URL     │
│ searchParams.get('token')            │
│ token = "32chartoken"                │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ User Fills Form:                     │
│ Email: test@example.com              │
│ First Name: Test                     │
│ Last Name: User                      │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ Frontend: POST to /api/employees/... │
│ Body: {                              │
│   token: "32chartoken",              │
│   email: "test@example.com",         │
│   first_name: "Test",                │
│   last_name: "User"                  │
│ }                                    │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ Backend: Accept Invite               │
│ 1. Find invite by token              │
│ 2. Validate status = pending         │
│ 3. Validate email matches            │
│ 4. Create or get user                │
│ 5. Create employee record            │
│ 6. Mark invite as accepted           │
│ 7. Return workspace_id + role        │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ Response: 200 OK                     │
│ {                                    │
│   success: true,                     │
│   workspace_id: "uuid",              │
│   role: "employee"                   │
│ }                                    │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ Frontend: Parse Response              │
│ Validate success = true               │
│ Validate workspace_id present         │
│ Extract workspace_id                  │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│ Frontend: Redirect                   │
│ Push to /dashboard/{id}/employees    │
│ Toast: "Invite accepted!"            │
└──────────────────────────────────────┘
```

---

## 📝 Implementation Checklist

### Frontend Requirements
- [x] Extract token from URL query params
- [x] Display invite form
- [x] Validate form inputs
- [x] Send POST request with token
- [x] Safe JSON parsing with try-catch
- [x] Validate response has success field
- [x] Extract workspace_id before redirect
- [x] Redirect on success
- [x] Show toast on error
- [x] Comprehensive logging

### Backend Requirements
- [x] Accept token in request body
- [x] Query database for invite by token
- [x] Validate invite is pending
- [x] Validate invite not expired
- [x] Validate email matches
- [x] Create or get user
- [x] Create employee record
- [x] Mark invite as accepted
- [x] Return workspace_id
- [x] Return role
- [x] Proper error responses
- [x] Comprehensive logging

### RPC Requirements
- [x] Generate secure token
- [x] Insert invite record
- [x] Return token to API
- [x] Validate authorization
- [x] Handle errors properly

---

## 🚀 Deployment Steps

1. **Verify Build:**
   ```bash
   npm run build  # Should be successful
   ```

2. **Test Locally:**
   ```bash
   npm run dev
   # Test invite creation and acceptance
   ```

3. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "Complete invite signup flow implementation"
   git push origin main
   ```

4. **Monitor Logs:**
   ```bash
   vercel logs --follow
   # Test and watch logs for any issues
   ```

5. **Test on Production:**
   - Create invite
   - Accept in private window
   - Verify redirect
   - Check Vercel logs

---

## 🔐 Security Features

- ✅ Token is random 128-bit (16 bytes) encoded as hex
- ✅ Email must match exactly (case-insensitive)
- ✅ Invite must be pending (not already used)
- ✅ Invite must not be expired (30 days default)
- ✅ Admin authorization validated at RPC level
- ✅ No authentication required for unauthenticated flow
- ✅ Employee created in correct workspace
- ✅ Comprehensive logging for audit trail

---

## 🎯 Success Criteria

- [ ] Invite created with valid token
- [ ] Token returned to frontend
- [ ] Invite link works in private window
- [ ] Form displays correctly
- [ ] Can submit form with valid data
- [ ] Backend validates token exists
- [ ] User created successfully
- [ ] Employee record created
- [ ] Invite marked as accepted
- [ ] Redirect to employees dashboard
- [ ] No console errors
- [ ] Logging shows complete flow
- [ ] Error messages are descriptive
- [ ] Can't reuse same invite
- [ ] Email mismatch is caught

---

All components are implemented and ready for testing!
