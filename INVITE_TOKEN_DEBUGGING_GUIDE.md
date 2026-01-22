# "Invalid or Expired Invite Token" - Complete Troubleshooting Guide

**Date:** January 22, 2026  
**Status:** Enhanced debugging implemented  
**Goal:** Diagnose exact cause of token rejection

---

## 🔄 What We Fixed & Enhanced

### ✅ Already Implemented
1. **Backend reads token from URL query** (not request body)
2. **Separates token lookup from status check** (better diagnostics)
3. **Enhanced logging at every step** (see exactly where it fails)

### 📊 New Debug Logs Added

The backend now logs:
- ✅ `[INVITE ACCEPT] token:` - Token received from URL
- ✅ `Token check result:` - Whether token exists & current status
- ✅ `Invite lookup failed:` - If token not found
- ✅ `Invite not pending:` - If token exists but already used
- ✅ `Expiration check:` - Exact times (expires_at vs now)
- ✅ `Email matching:` - Both emails compared
- ✅ `Invite found:` - Full invite details when found

---

## 🧪 How to Debug (Step-by-Step)

### Step 1: Create an Invite
```
1. Go to admin dashboard
2. Create invite for: test@example.com
3. Copy the invite link
4. **Note the token** from the link
   Format: /invite?token=75a08d9ecb988f...
```

### Step 2: Check Browser Console
```javascript
// Open DevTools (F12) → Console tab
// The form should log:
[InviteForm] Token from URL: { 
  token: "75a08d9ec...",
  token_length: 64,
  param_name: "token"
}
```

**If token is missing/empty:**
- Problem: URL parsing failed
- Solution: Check browser's query string extraction

### Step 3: Fill & Submit Form
```
Email: test@example.com
First: John
Last: Doe
Password: TestPass123!

Click "Accept Invitation"
```

### Step 4: Check Vercel Logs
Go to **Vercel Dashboard → Functions → Logs**

Look for these logs in order:

```
[INVITE ACCEPT] token: 75a08d9ecb988...
  ↓
Token check result: {
  found: true,
  status: "pending",
  error: null
}
  ↓
Invite found: {
  invite_id: "550e8400-...",
  token_match: true,
  email: "test@example.com",
  status: "pending"
}
  ↓
Email matching: {
  db_email: "test@example.com",
  request_email: "test@example.com",
  match_case_insensitive: true
}
  ↓
[User ${userId} accepted invite to workspace...]
  ↓
SUCCESS! User redirected to dashboard
```

---

## 🔴 Failure Scenarios & How to Fix

### Scenario 1: Token Not Found
```
Token check result: {
  found: false,
  status: null,
  error: null
}
```

**Possible Causes:**
1. Token not stored in database
2. Token stored differently than in URL
3. Token encoding mismatch

**How to Fix:**
```sql
-- Check if token exists
SELECT id, email, token, status 
FROM employee_invites 
WHERE email = 'test@example.com'
ORDER BY created_at DESC 
LIMIT 1;

-- Compare token formats
-- URL token: 75a08d9ecb988...
-- DB token:  should match exactly
```

**Solution:**
- If token is NULL in DB → Problem is in invite creation
- If token differs from URL → Encoding issue (see below)

---

### Scenario 2: Token Found But Status Not Pending
```
Token check result: {
  found: true,
  status: "accepted"  ← Problem!
}

OR

Invite not pending: {
  current_status: "rejected",
  token: "75a08d9..."
}
```

**Possible Cause:** Invite was already used or rejected

**How to Fix:**
```sql
-- Check when it was accepted/rejected
SELECT 
  id, 
  email, 
  status, 
  accepted_at,
  rejected_at,
  created_at
FROM employee_invites 
WHERE token = '75a08d9ecb988...';

-- If needed, reset status back to 'pending'
UPDATE employee_invites 
SET status = 'pending',
    accepted_at = NULL
WHERE token = '75a08d9ecb988...'
  AND email = 'test@example.com';
```

---

### Scenario 3: Token Found, Pending, But Expired
```
Expiration check: {
  expires_at: "2026-01-21T10:00:00Z",
  now: "2026-01-22T15:00:00Z",
  is_expired: true,
  time_remaining_ms: -101400000
}
```

**Possible Cause:** Invite token has expired (usually 30 days)

**How to Fix:**
```sql
-- Check and extend expiration
SELECT 
  id,
  created_at,
  expires_at,
  (expires_at::timestamp - created_at::timestamp) as validity_period
FROM employee_invites
WHERE email = 'test@example.com';

-- If needed, extend expiration
UPDATE employee_invites
SET expires_at = NOW() + INTERVAL '30 days'
WHERE email = 'test@example.com';
```

---

### Scenario 4: Email Mismatch
```
Email matching: {
  db_email: "john@example.com",
  request_email: "john.smith@example.com",
  match_case_insensitive: false
}
```

**Possible Cause:** User entered different email than invitation

**Solution:** Have user enter the EXACT email the invite was sent to

**To Reset:** Create a new invite for the correct email

---

### Scenario 5: Token Encoding Issue

**If token contains special characters:**
```
URL: /invite?token=75a08d9+test%20token/xyz==

Decoded token: 75a08d9+test token/xyz==
DB has stored: 75a08d9+test token/xyz==
```

**Debug:**
```javascript
// In browser console
const urlToken = new URLSearchParams(window.location.search).get('token');
console.log('URL token:', urlToken);
console.log('Decoded:', decodeURIComponent(urlToken));
```

**If needed, fix frontend:**
```typescript
// app/invite/invite-form.tsx
const rawToken = new URLSearchParams(window.location.search).get('token');
const token = decodeURIComponent(rawToken); // Ensure decoded

// Then send to backend
const acceptUrl = `/api/employees/accept-invite?token=${encodeURIComponent(token)}`;
```

---

### Scenario 6: RLS Policy Blocking

**If error is a database error, not "not found":**
```
Token lookup database error: {
  message: "new row violates row level security policy",
  code: "42501"
}
```

**Solution:** Check Supabase RLS policies

```sql
-- View all policies on employee_invites
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'employee_invites';
```

**Create permissive policy if needed:**
```sql
CREATE POLICY "allow_read_pending_invites"
ON employee_invites
FOR SELECT
USING (status = 'pending');
```

---

## 📋 Complete Debug Checklist

```
STEP 1: Invite Creation
□ Admin creates invite
□ Check Vercel logs for:
  [/api/employees/invite POST] Invite created with token:
  └─ Should show token_length: 64 (typical)

□ Query database:
  SELECT token FROM employee_invites WHERE email='test@example.com'
  └─ Token should be present & non-NULL

STEP 2: Frontend Token Extraction
□ Open invite link in browser
□ Check browser console:
  [InviteForm] Token from URL: { token: "...", token_length: 64 }
  └─ Should match token from email
  
□ Check form loads correctly
□ Fill all fields

STEP 3: Form Submission
□ Click "Accept Invitation"
□ Check browser network tab:
  POST /api/employees/accept-invite?token=75a08...
  └─ Token should be in URL, not body

STEP 4: Backend Processing
□ Check Vercel logs for:
  [INVITE ACCEPT] token: 75a08...
  └─ Token should be received

□ Check for Token check result log:
  found: true/false ← KEY INDICATOR

STEP 5: Invite Lookup
If found=true:
  □ Status should be "pending"
  □ Email should match request
  □ Expiration should be in future
  □ All checks should pass

If found=false:
  □ Query database directly
  □ Check if token exists
  □ Compare token formats/encoding
  □ Verify RLS policies

STEP 6: Success or Error
□ Success: Redirect to /employee/dashboard
□ Error: Check specific error message from logs
```

---

## 🚀 Common Quick Fixes

**Token not found in DB?**
```sql
UPDATE employee_invites 
SET token = '75a08d9ecb988f3815c55d0fc55982ecee019c9664f6e7195581c1ab0bedd9a6'
WHERE email = 'test@example.com' AND token IS NULL;
```

**Invite already used?**
```sql
UPDATE employee_invites 
SET status = 'pending'
WHERE email = 'test@example.com';
```

**Invite expired?**
```sql
UPDATE employee_invites 
SET expires_at = NOW() + INTERVAL '30 days'
WHERE email = 'test@example.com';
```

**Need to see all invite data?**
```sql
SELECT 
  id,
  email,
  token,
  status,
  created_at,
  expires_at,
  accepted_at,
  workspace_id
FROM employee_invites
WHERE email = 'test@example.com'
ORDER BY created_at DESC;
```

---

## 📞 Logs to Monitor

**Success path logs:**
```
[INVITE ACCEPT] token: ...
Token check result: { found: true, status: "pending" }
Invite found: { invite_id: "...", email: "..." }
Email matching: { match_case_insensitive: true }
[/api/employees/accept-invite POST] User ... accepted invite
```

**Failure path logs:**
```
[INVITE ACCEPT] token: ...
Token check result: { found: false }  ← Stop here!
[/api/employees/accept-invite POST] Invite lookup failed
  reason: Token not found
```

---

## 🎯 What to Report

When asking for help, include:
1. **Exact error message** from toast
2. **Token from URL** (first 16 chars)
3. **Vercel logs** showing [INVITE ACCEPT] line
4. **Database query result** for that email
5. **Screenshot** of browser console

Example:
```
Error: "Invalid or expired invite token"
Token: 75a08d9ecb988f38...
DB Query: SELECT * FROM employee_invites WHERE email='john@example.com'
  → Returns: token is NULL / token differs / status is 'accepted'
```

---

## ✨ Next Steps

1. **Deploy** current changes (enhanced logging)
2. **Test** invite acceptance
3. **Check logs** using guide above
4. **Apply fix** based on which scenario matches
5. **Retest** to verify resolution

The new logs will pinpoint exactly where the problem is!

---

**Status:** ✅ Ready to Debug with Enhanced Logging

**Files Updated:**
- [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts) - Enhanced debugging
- [INVITE_TOKEN_ERROR_SOLUTIONS.md](INVITE_TOKEN_ERROR_SOLUTIONS.md) - Detailed solutions

**Deploy & Test:** `git push origin main`
