# 🔍 Token Acceptance Debugging Guide

**Status:** ENHANCED DEBUGGING ADDED  
**Date:** January 22, 2026  
**Issue:** Token exists & matches in DB but still getting "Invalid or expired invite token"

---

## 🎯 What We Know (Confirmed)

✅ Token generated: `de91a58e9bc39a8a66be30a30947c8fdbee6cf487d55a1a8606e0fc1b5c7327a`  
✅ Token in URL: matches exactly  
✅ Token in DB: matches exactly  
✅ Status: `pending`  
✅ Email: `now@demo.com`  
❌ Still getting error: "Invalid or expired invite token"

**This means:** The token lookup is failing, OR the error is coming from somewhere else (not the token check).

---

## 🔧 Enhanced Debugging Steps

### Step 1: Check Vercel Logs
Go to **Vercel Dashboard** → **Your Project** → **Logs** → **Functions**

Look for these log patterns:

```
[INVITE ACCEPT] token: de91a58e...
[INVITE ACCEPT] Full URL: https://...
[INVITE ACCEPT] Token details: {
  token_value: "de91a58e...",
  token_length: 64,
  is_string: true,
  has_percent_encoding: false,
  has_spaces: false,
  has_plus: false
}
```

**What to check:**
- Is the token being extracted correctly?
- Are there any URL encoding issues (% symbols)?
- Is the token length 64 characters?

---

### Step 2: Token Lookup Phase

Look for:
```
[/api/employees/accept-invite POST] Step 1: Token lookup starting...
[/api/employees/accept-invite POST] Step 1: Token lookup result: {
  found: true/false,
  token_sent_length: 64,
  token_db_length: 64,
  status: "pending",
  error: null or error message
}
```

**If `found: false`:**
- The query is returning no results
- Check: Does the token in URL match exactly what's in DB?
- Check: Is there only ONE invite with this token?

**If `found: true`:**
- Continue to next steps

---

### Step 3: Status Check

Look for:
```
[/api/employees/accept-invite POST] Step 2: Status check...
[/api/employees/accept-invite POST] Step 2: ✅ Status is pending
```

**If you see ❌ instead of ✅:**
- The invite status is NOT 'pending'
- It might be 'accepted' or something else
- This means the token was already used

---

### Step 4: Expiration Check

Look for:
```
[/api/employees/accept-invite POST] Step 3: Expiration check...
[/api/employees/accept-invite POST] Step 3: ✅ Not expired
```

**If you see ❌:**
- The invite token has expired
- Check: Is `expires_at` set? Is it in the past?

---

### Step 5: Email Check

Look for:
```
[/api/employees/accept-invite POST] Step 4: Email matching check...
[/api/employees/accept-invite POST] Email comparison: {
  db_email: "now@demo.com",
  request_email: "now@demo.com",
  match_case_insensitive: true
}
[/api/employees/accept-invite POST] Step 4: ✅ Email matches
```

**If you see ❌:**
- The email from the form doesn't match the invite email
- Check: Did user enter the correct email?
- Check: Are there trailing spaces?

---

## 🚨 Possible Root Causes

### Cause 1: Token NOT Being Extracted from URL
**Evidence to look for:**
```
[INVITE ACCEPT] token: null
or
[INVITE ACCEPT] Token validation failed
```

**Fix:**
- Make sure you're using `?token=...` in the URL (not `#token=...`)
- Try copying the URL again and testing in a fresh incognito window

---

### Cause 2: Token Lookup Returns Nothing
**Evidence:**
```
[/api/employees/accept-invite POST] Step 1: Token lookup result: {
  found: false
}
[/api/employees/accept-invite POST] Token not found in database
```

**Why this happens:**
- Token has special characters that URL encoding is changing
- Token in URL is different from token in DB
- RLS policies preventing the lookup

**Fix:**
- Log the exact bytes of both tokens to compare
- Check Supabase RLS policies on `employee_invites` table
- Verify no filters are hiding the row

---

### Cause 3: Email Mismatch
**Evidence:**
```
[/api/employees/accept-invite POST] Step 4: ❌ Email mismatch
[/api/employees/accept-invite POST] Email comparison: {
  db_email: "now@demo.com",
  request_email: "now@demo.com",  // Looks the same but...
  match_case_insensitive: false
}
```

**Why this happens:**
- Trailing/leading spaces: `"now@demo.com "` vs `"now@demo.com"`
- Different case handling
- Unicode characters that look the same

**Fix:**
- Check backend logs for email formatting
- Look at the database directly to see the exact email stored
- Trim the email in the form before sending

---

### Cause 4: Expired Token
**Evidence:**
```
[/api/employees/accept-invite POST] Step 3: ❌ Invite expired
[/api/employees/accept-invite POST] Expiration details: {
  is_expired: true,
  time_remaining_ms: -86400000
}
```

**Fix:**
- Generate a new invite (the old one expired)

---

## 🔬 Database Query to Run

Check the exact token and invite state:

```sql
SELECT 
  id,
  email,
  token,
  status,
  expires_at,
  invited_by,
  created_at,
  updated_at
FROM employee_invites
WHERE email = 'now@demo.com'
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- Is the token exactly matching?
- Is status 'pending'?
- Is expires_at in the future?
- Are there multiple invites for this email?

---

## 🧪 Test with Direct API Call

Instead of using the form, test the API directly:

```bash
# Replace with actual token and email
TOKEN="de91a58e9bc39a8a66be30a30947c8fdbee6cf487d55a1a8606e0fc1b5c7327a"
EMAIL="now@demo.com"

curl -X POST "http://localhost:3000/api/employees/accept-invite?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$EMAIL'",
    "first_name": "Test",
    "last_name": "User",
    "password": "TestPass123!"
  }' \
  | jq .
```

This bypasses the frontend and lets you see raw backend response.

---

## 🎯 Next Steps to Debug

1. **Look at Vercel logs** and find the Step 1, 2, 3, 4 logs
2. **Identify which step is failing** (check for ❌ vs ✅)
3. **Tell me which step fails** with the exact log output
4. **I'll provide specific fix** for that issue

---

## 📊 Debugging Checklist

- [ ] Vercel logs checked
- [ ] Token extraction confirmed (Step 1 logs)
- [ ] Token found in DB (Step 1: `found: true`)
- [ ] Status is pending (Step 2: ✅)
- [ ] Not expired (Step 3: ✅)
- [ ] Email matches (Step 4: ✅)
- [ ] All validation passed
- [ ] Still getting error?

---

## 💡 Quick Tests

### Test 1: Generate New Invite
```
1. Admin creates NEW invite for now@demo.com
2. Copy fresh token from invite link
3. Try to accept immediately
4. Check logs
```

### Test 2: Try Different Email
```
1. Generate invite for different@demo.com
2. Try to accept with different@demo.com
3. Check if it works
```

### Test 3: Bypass Frontend
```
1. Use curl/Postman to POST directly to API
2. Send token in URL, data in body
3. See if API accepts it
```

### Test 4: Check Admin Role
```
1. Verify admin who created invite has correct role
2. Verify admin is linked to workspace correctly
3. Check admin_access table
```

---

## 📝 Share These Logs

When you run through the debug steps, please share:

1. **Vercel logs** from Step 1-4
2. **Database query result** showing the invite
3. **Frontend console logs** when submitting form
4. **The exact error message** you're seeing

With this info, I can pinpoint the exact issue!

---

**Status:** Ready for debugging  
**Last Updated:** January 22, 2026
