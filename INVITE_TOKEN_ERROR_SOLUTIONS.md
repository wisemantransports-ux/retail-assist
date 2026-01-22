# Invite Token "Invalid or Expired" Error - Diagnostic & Solutions

**Error:** `[InviteForm] Error accepting invite: "Invalid or expired invite token"`

**Root Cause Options:** Token not found OR status not 'pending' OR token encoding mismatch OR expires_at filtering

---

## 🔍 Solution Approach: Progressive Debugging

### SOLUTION 1: Check Token Lookup Separately ✅ IMPLEMENTED
**What it does:** Separates token lookup from status check for better diagnostics

```typescript
// First: Look up by token ONLY
const { data: tokenCheckData } = await supabase
  .from('employee_invites')
  .select('*')
  .eq('token', token)
  .maybeSingle();

// If found, THEN check status
if (!tokenCheckData) {
  return error('Token not found'); // Clear error
}
if (tokenCheckData.status !== 'pending') {
  return error('Token already used'); // Clear error
}
```

**Why:** Shows exactly where the failure is:
- Token doesn't exist in DB? → Problem with token generation/storage
- Token exists but status != 'pending'? → Invite already accepted
- Token exists and status='pending' but expires_at is past? → Expiration issue

---

### SOLUTION 2: Check Token Encoding Issues
**Problem:** Token might be URL-encoded on frontend, but DB stores it unencoded

**Check:**
```bash
# In browser console, before form submission:
const token = new URLSearchParams(window.location.search).get('token');
console.log('Raw token from URL:', token);
console.log('Has %20:', token.includes('%20'));
console.log('Has +:', token.includes('+'));
```

**Fix in frontend if needed:**
```typescript
// If token has %20 or other encoding, decode it:
const rawToken = new URLSearchParams(window.location.search).get('token');
const decodedToken = decodeURIComponent(rawToken);

// Then use decodedToken in the fetch
const acceptUrl = `/api/employees/accept-invite?token=${encodeURIComponent(decodedToken)}`;
```

**Fix in backend:**
```typescript
// Ensure token is decoded
const token = decodeURIComponent(searchParams.get('token') || '');
```

---

### SOLUTION 3: Check If Token is Actually Being Generated
**Add this to the invite creation endpoint** (`/api/employees/route.ts`):

```typescript
console.log('[/api/employees/invite POST] Token generated:', {
  token: invite[0]?.token,
  token_length: invite[0]?.token?.length,
  token_preview: invite[0]?.token?.substring(0, 20),
  stored_successfully: !!invite[0]?.token,
});
```

**Verification query:**
```sql
-- Check if token was actually stored
SELECT id, email, token, status, created_at 
FROM employee_invites 
WHERE email = 'test@example.com'
ORDER BY created_at DESC
LIMIT 1;
```

**If token is NULL:** Problem is in invite creation, not acceptance

---

### SOLUTION 4: Check Expires_at Logic
**Problem:** Invite might be marked as expired even though it's recent

**Current code:**
```typescript
if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
  return error('Invite expired');
}
```

**Debug version:**
```typescript
if (inviteData.expires_at) {
  const expiresAt = new Date(inviteData.expires_at);
  const now = new Date();
  console.log('[DEBUG] Expiration check:', {
    expires_at: expiresAt.toISOString(),
    now: now.toISOString(),
    is_expired: expiresAt < now,
    time_remaining_ms: expiresAt - now,
  });
  
  if (expiresAt < now) {
    return error('Invite expired');
  }
}
```

**If expires_at is NULL:** Query won't filter it, should work fine

---

### SOLUTION 5: Check Supabase RLS Policies
**Problem:** RLS policies might prevent reading the invite

**Diagnostic:**
```typescript
// Try query WITHOUT any filters
const { data: allInvites, error: allError } = await supabase
  .from('employee_invites')
  .select('id, token, status')
  .limit(1);

if (allError) {
  console.error('[RLS ERROR]', allError);
  // RLS is blocking the query
}
```

**Check in Supabase:**
```sql
-- View RLS policies on employee_invites
SELECT * FROM pg_policies 
WHERE tablename = 'employee_invites';
```

**Solution:** RLS policy might need to allow anonymous users to read pending invites:
```sql
CREATE POLICY "Allow anyone to read pending invites"
ON employee_invites
FOR SELECT
USING (status = 'pending');
```

---

### SOLUTION 6: Check Token Column Data Type
**Problem:** Token might be stored differently than queried

**Verify in Supabase:**
```sql
-- Check token column definition
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'employee_invites'
  AND column_name = 'token';

-- Check actual token values
SELECT 
  id,
  token,
  length(token) as token_length,
  status,
  created_at
FROM employee_invites
WHERE status = 'pending'
LIMIT 5;
```

**If token has trailing spaces or special characters:** Clean in DB or adjust query

---

### SOLUTION 7: Alternative Query Strategy - Use ILIKE for Case-Insensitive
**Current:**
```typescript
.eq('token', token)  // Exact match only
```

**Alternative (if case-insensitive needed):**
```typescript
.ilike('token', token)  // Case-insensitive
```

---

### SOLUTION 8: Try Raw SQL Query
**As last resort, use raw SQL to bypass any abstraction issues:**

```typescript
const { data, error } = await supabase.rpc('get_invite_by_token', {
  p_token: token,
});

if (error) {
  console.error('RPC error:', error);
  return error_response;
}
```

**Create RPC function:**
```sql
CREATE OR REPLACE FUNCTION get_invite_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  email TEXT,
  invited_by UUID,
  status TEXT,
  expires_at TIMESTAMP,
  token TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    employee_invites.id,
    employee_invites.workspace_id,
    employee_invites.email,
    employee_invites.invited_by,
    employee_invites.status,
    employee_invites.expires_at,
    employee_invites.token
  FROM employee_invites
  WHERE employee_invites.token = p_token;
END;
$$ LANGUAGE plpgsql;
```

---

## 📋 Diagnostic Checklist

Run through in order:

```
□ Check browser console for '[INVITE ACCEPT] token: ...'
  → Verify token is in logs

□ Check Vercel function logs for token lookup result
  → Verify token was received in backend

□ Check if token exists in DB
  SELECT * FROM employee_invites WHERE token = '...';
  → If no results, token generation failed

□ Check if token status is 'pending'
  → If 'accepted' or 'rejected', invite was already used

□ Check if token is URL-encoded on frontend
  console.log(window.location.search)
  → Look for %20, +, etc.

□ Check Supabase RLS policies
  → Ensure anon users can read pending invites

□ Check token column in DB
  → Verify data type matches what we're querying

□ Check expires_at
  → Verify it's NULL or in the future
```

---

## 🛠️ Quick Fix: Add Better Error Response

**Send more details to frontend so user knows what's wrong:**

```typescript
// Instead of generic "Invalid or expired invite token"
// Return detailed error:

const reasons = [];

if (!tokenCheckData) {
  reasons.push('Token not found');
} else {
  if (tokenCheckData.status !== 'pending') {
    reasons.push(`Status is ${tokenCheckData.status}, not pending`);
  }
  if (tokenCheckData.expires_at && new Date(tokenCheckData.expires_at) < new Date()) {
    reasons.push('Invite has expired');
  }
}

console.error('[/api/employees/accept-invite POST] Invite lookup failed:', {
  token: token.substring(0, 8) + '...',
  reasons,
  tokenCheckData,
});

return NextResponse.json(
  { 
    success: false, 
    error: 'Invalid or expired invite token',
    debug: reasons, // Only in dev
  },
  { status: 400 }
);
```

---

## 🚀 Implementation Priority

1. **HIGH:** Implement Solution 1 (Separate token lookup) ✅ DONE
2. **HIGH:** Add debug logging to invite creation endpoint
3. **MEDIUM:** Check DB for actual invite data
4. **MEDIUM:** Test token encoding on frontend
5. **LOW:** Check RLS policies
6. **LOW:** Review token column data type

---

## Testing After Each Fix

```bash
# 1. Create invite via admin
# 2. Copy link with token
# 3. Check browser console - token should be present
# 4. Check Vercel logs - token lookup should show found/not found
# 5. Check DB query - token should be there
# 6. Accept invite - should show where it fails

# Monitor logs in real-time:
# Vercel Dashboard → Functions → Logs
# Filter for: [INVITE ACCEPT] or [accept-invite POST]
```

---

## Next Steps

1. **Deploy current changes** (Solution 1 - better token lookup)
2. **Test and check logs** for where it fails
3. **Apply matching solution** from list above
4. **Re-test** until token is found and accepted

The enhanced logging will tell you exactly which step is failing.

---

**Status:** ✅ Solution 1 Implemented & Deployed  
Ready to test and debug with new logs!
