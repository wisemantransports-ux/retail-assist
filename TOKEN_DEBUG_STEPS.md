# Token Acceptance Error - Diagnostic Steps

## Error You're Seeing
```
[InviteForm] Error accepting invite: "Invalid or expired invite token"
```

## What We've Done to Help Debug

We've added **comprehensive logging** to help identify why the token doesn't match. Here's what you need to do:

---

## Step 1: Deploy the Updated Code

The code now has much better logging. Deploy to Vercel:

```bash
git add .
git commit -m "Add detailed token logging for debugging"
git push origin main
```

Wait for Vercel to deploy.

---

## Step 2: Test and Watch the Logs

### 2A: Create an Invite in Your App
1. Login as admin
2. Go to Employees page
3. Click "Invite Employee"
4. Enter **YOUR EMAIL ADDRESS** (one you have access to!)
5. Invite gets created
6. You'll see a modal with the invite link

**Example:**
```
https://your-app.vercel.app/invite?token=3f8a7b9c2d1e4f6a1b2c3d4e5f6a7b8c
```

**Copy this link and the token!**

### 2B: Open DevTools and Watch Console
1. Open the invite link in a **NEW private/incognito window**
2. Press F12 to open DevTools
3. Go to "Console" tab
4. You should see logs starting with `[InviteForm]`
5. **Copy all the logs** - especially these:
   ```
   [InviteForm] Token extracted from URL: { token: "3f8a...", token_length: 32, ... }
   [InviteForm] Token from URL: { token: "3f8a...", ...}
   [InviteForm] Request sent with token: { token_sent: "3f8a...", ...}
   ```

### 2C: Try to Accept the Invite
1. Fill in the form:
   - Email: **SAME EMAIL** you used to create the invite
   - First Name: Test
   - Last Name: User
2. Click "Accept Invitation"
3. **DON'T CLOSE DevTools** - keep watching console
4. You'll see more logs including the error:
   ```
   [InviteForm] Error accepting invite: "Invalid or expired invite token"
   ```

---

## Step 3: Check Vercel Logs

While the form is being tested, Vercel logs will show the backend side:

```bash
vercel logs --follow
```

**Look for logs like:**
```
[/api/employees/accept-invite POST] Looking up invite with token: { token_received: "3f8a...", token_length: 32, ... }
[/api/employees/accept-invite POST] Invite lookup error: { error: "No rows found", code: "PGRST116" }
[/api/employees/accept-invite POST] Sample pending invites for debugging: [...]
```

---

## Step 4: Diagnose the Problem

Once you have the logs from Step 2 and Step 3, compare:

### Check 1: Token Format
```
Browser Console:     [InviteForm] Token from URL: { token: "3f8a..." }
Vercel Backend Log:  [/api/employees/accept-invite POST] Looking up invite: { token_received: "3f8a..." }
```

**Are they IDENTICAL?** If not, something is mangling the token.

### Check 2: Token Length
```
Browser: token_length: 32
Backend: token_length: 32
```

Should be the same. If different, token is being corrupted.

### Check 3: Sample Pending Invites
Vercel logs show:
```
Sample pending invites for debugging: [
  { token_db: "3f8a...", token_length: 32, email: "..." }
]
```

**Compare:**
- Is your token in the list?
- Do the token previews match (first 16 chars)?
- If NO - your token was never created in the database!

### Check 4: Email Match
When invite is found, backend logs:
```
Invite found: {
  invite_id: "uuid",
  token_match: true,
  email: "your-email@example.com"
}
```

The email in the database should match the email you're using in the form.

---

## Most Common Issues & Solutions

### Issue 1: "No rows found" in Backend Log
**Means:** Token doesn't exist in database

**Solutions:**
- Token wasn't saved when invite was created
- Token was deleted or revoked
- Using wrong Supabase environment

**Check:**
```
vercel logs | grep "Sample pending invites"
```
Does YOUR token appear in the list?

### Issue 2: Token Previews Don't Match
**Example:**
```
Browser sends:  token: "3f8a7b9c..."
Backend sees:   token_received: "xGFt5Dk3..."
```

**Means:** Token is being corrupted/modified in transit

**Solutions:**
- URL encoding issue (check if token has `%` or `+`)
- Special characters being stripped
- Form data not being sent correctly

**Check:**
```
[InviteForm] Token from URL: { contains_percent: false, contains_plus: false }
```

### Issue 3: Token Exists but Not Matching
**Example:**
```
DB Token:       "3f8a7b9c2d1e4f6a..."  (32 chars)
Request Token:  "3f8a7b9c2d1e4f6a"     (16 chars)
```

**Means:** Token is being truncated somewhere

**Solutions:**
- Check if database has partial token
- Check if form is sending only first half
- Check if API endpoint is truncating

---

## Data to Collect & Report

When you're ready to debug, please provide:

1. **Invite Link:**
   ```
   https://your-app.vercel.app/invite?token=XXXXXXXX...
   ```

2. **Browser Console Logs** (copy-paste the JSON objects from `[InviteForm]` logs):
   ```
   {
     "token": "...",
     "token_length": 32,
     "token_preview": "..."
   }
   ```

3. **Backend Logs** (from `vercel logs`):
   ```
   [/api/employees/accept-invite POST] Looking up invite: {...}
   [/api/employees/accept-invite POST] Sample pending invites: {...}
   ```

4. **Email Used:**
   ```
   Which email did you use to create the invite?
   Which email are you using in the form?
   Are they identical?
   ```

5. **Environment:**
   ```
   - Testing on: Vercel / Local
   - Supabase environment: Production / Staging / Local
   ```

---

## Quick Test Checklist

- [ ] Deploy new code to Vercel
- [ ] Create invite for your email: `your.email@example.com`
- [ ] Copy token from invite link
- [ ] Open DevTools in new private window
- [ ] Go to invite link
- [ ] Check console logs for token format
- [ ] Fill form with SAME email
- [ ] Submit form
- [ ] Check console for error details
- [ ] Check Vercel logs for backend response
- [ ] Compare token formats between browser and backend
- [ ] Report findings

---

## Expected Successful Flow

When it works, you should see:

**Browser Console:**
```
[InviteForm] Token extracted from URL: { token: "3f8a7b9c2d1e4f6a1b2c3d4e5f6a7b8c", token_length: 32 }
[InviteForm] Submitting invite acceptance: { token: "3f8a..." }
[InviteForm] Request sent with token: { token_sent: "3f8a7b9c2d1e4f6a1b2c3d4e5f6a7b8c" }
[InviteForm] Response status: 200
[InviteForm] Parsed response: {success: true, workspace_id: "...", role: "employee"}
[InviteForm] Redirecting to: /dashboard/.../employees
```

**Vercel Logs:**
```
[/api/employees/accept-invite POST] Accepting invite: { token: "3f8a...", token_length: 32 }
[/api/employees/accept-invite POST] Invite found: { token_match: true, email: "your-email@example.com" }
[/api/employees/accept-invite POST] User ... accepted invite to workspace ...
```

---

The comprehensive logging will pinpoint exactly where the mismatch is happening!
