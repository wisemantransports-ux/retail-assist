# Token Mismatch Debugging Guide

## Error You're Seeing
```
[InviteForm] Error accepting invite: "Invalid or expired invite token"
```

## Root Cause (Most Likely)
The token in the URL **doesn't match** a pending invite in the database. This could happen if:

1. **Token was never created** - Invite wasn't actually sent
2. **Token was created but lost** - Invite deleted/revoked
3. **Token format mismatch** - URL encoding issue or token corruption
4. **Token already used** - Invite was already accepted
5. **Wrong database** - Testing locally vs production data

---

## Debugging Steps

### Step 1: Check Your Invite Link
Look at the URL when you click the invite link:
```
https://your-app.com/invite?token=abc123def456...
                                   ↑ This should be the long token
```

**What you're looking for:**
- Should have a `token` or `invite` query parameter
- Token should be a long hex string (30-50+ characters)
- Examples: `token=3f8a7b9c2d1e4f6a...` or `invite=a1b2c3d4e5f6...`

### Step 2: Check the Database
You need to check if the invite exists in Supabase with that exact token.

**Connect to Supabase directly:**
1. Go to https://app.supabase.com
2. Select your project
3. Click "SQL Editor"
4. Run this query:
```sql
SELECT id, token, email, status, created_at, expires_at 
FROM employee_invites 
ORDER BY created_at DESC 
LIMIT 10;
```

**Look for:**
- Your test email in the list
- Status should be `pending`
- Compare token in DB vs URL - should match exactly!
- Check if `expires_at` is in the future

### Step 3: Check Browser Console
When you try to accept, check DevTools Console (F12 → Console) for this log:
```
[InviteForm] Token from URL: { token: "3f8a..." , token_length: 45, param_name: "token" }
```

**What to look for:**
- `token_length` - should be 30+, not 5-10
- `param_name` - should be "token" or "invite", not "none"
- If `param_name: "none"`, the token isn't in the URL at all

### Step 4: Check Backend Logs
Deploy to Vercel and check logs:
```
vercel logs --follow
```

Look for:
```
[/api/employees/accept-invite POST] Accepting invite: { token: "3f8a...", token_length: 45, email: "test@example.com", first_name: "Test" }
[/api/employees/accept-invite POST] Invite lookup error: { error: "No rows found", code: "PGRST116" }
```

**Key indicators:**
- If `No rows found` (PGRST116): Token doesn't exist in database
- If `error: null`: Token found but something else failed
- Token length mismatch between URL and request body

---

## Common Scenarios & Solutions

### Scenario 1: Token Not in URL
**Console shows:** `param_name: "none"` or `token_length: 0`

**Solution:**
- Check invite link format
- Link should be: `/invite?token=ABC123...`
- If you see `/invite?invite=ABC123...`, that's also OK (we support both)
- If no token parameter at all: invite link wasn't created correctly

### Scenario 2: Token in URL But Not in Database
**Console shows:** `token: "3f8a..."`
**Backend logs:** `error: "No rows found"`

**Solutions:**
1. Verify invite was actually created
   - Check if invite creation succeeded in admin panel
   - Look for invite in database query above
2. Verify using correct database environment
   - Local dev? Should use local Supabase
   - Vercel? Should use production Supabase
   - Staging? Should use staging Supabase
3. Token might have been corrupted
   - Create a NEW invite and try fresh

### Scenario 3: Token Exists But Status Not "pending"
**Database shows:** Status = `"accepted"` or `"revoked"`

**Solution:**
- Invite was already accepted or canceled
- Create a new invite for testing
- Or manually update in database:
```sql
UPDATE employee_invites 
SET status = 'pending', accepted_at = NULL 
WHERE token = 'YOUR_TOKEN_HERE';
```

### Scenario 4: Token Expired
**Database shows:** `expires_at < now()`

**Solution:**
- Invite is too old
- Create a new invite
- Or manually reset:
```sql
UPDATE employee_invites 
SET expires_at = now() + interval '7 days' 
WHERE token = 'YOUR_TOKEN_HERE';
```

### Scenario 5: Empty Email in Invite
**Database shows:** `email` is NULL or empty

**Causes:**
- Invite creation didn't save email properly
- Database corruption
- RPC issue

**Solution:**
- Check RPC logs during invite creation
- Recreate the invite

---

## Testing with Real vs Test Emails

### Real Email Requirement
The invite system currently **requires a real email address** because:
1. Email is used to match when accepting the invite
2. If you create an invite for `test123@fake.com` but accept with `test456@fake.com`, it fails
3. Emails must match **exactly** (case-insensitive)

### Example Test Process
```
1. Create invite for: john.doe@gmail.com
2. Copy invite link
3. Open link (will show /invite?token=ABC123...)
4. In form, enter SAME email: john.doe@gmail.com
5. Should work!

6. If you try with different email: jane.smith@gmail.com
   → Error: "Email does not match the invitation"
```

### Using Test Emails
You can use any real email you have access to:
- Your personal email: `your.name@gmail.com`
- Work email: `you@company.com`
- Test email from email service: `test@mailinator.com` (temporary)
- Disposable email: `anything@10minutemail.com`

---

## Advanced Debugging

### Query to Find All Tokens by Email
```sql
SELECT token, status, created_at, expires_at 
FROM employee_invites 
WHERE email ILIKE '%your-email@example.com%' 
ORDER BY created_at DESC;
```

### Query to Check Token Exists
```sql
SELECT * FROM employee_invites 
WHERE token = 'PASTE_YOUR_TOKEN_HERE';
```

If returns nothing: Token definitely doesn't exist

### Query to Check Invite Timeline
```sql
SELECT id, email, status, created_at, expires_at, accepted_at 
FROM employee_invites 
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
ORDER BY created_at DESC 
LIMIT 20;
```

Shows all invites and their lifecycle

---

## Testing Checklist

- [ ] Invite link has token parameter: `/invite?token=...`
- [ ] Token is long (30+ characters), not short
- [ ] Copy exact token from URL to database query
- [ ] Token exists in `employee_invites` table
- [ ] Token status is `pending` (not accepted/revoked)
- [ ] Token not expired (expires_at > now)
- [ ] Email matches exactly between DB and form
- [ ] Using same Supabase environment (local/staging/prod)
- [ ] No typos in email address

---

## Quick Reference: Token Lookup

Run this to find ALL active test tokens:
```sql
SELECT token, email, status, created_at, expires_at 
FROM employee_invites 
WHERE status = 'pending' AND expires_at > now()
ORDER BY created_at DESC
LIMIT 20;
```

Then test with one of these tokens by manually constructing URL:
```
https://your-app.com/invite?token=<paste_token_here>
```

---

## If Still Having Issues

**Collect this info and report:**
1. Exact token from URL (first 20 chars): `abc123...`
2. Exact email used in form
3. Console output from F12 (screenshot or paste)
4. Database query result showing the row
5. Backend logs from Vercel (last 30 seconds)
6. Are you testing locally or on Vercel?
7. Did invite creation show success message?

The logs should tell us exactly where the mismatch is!
