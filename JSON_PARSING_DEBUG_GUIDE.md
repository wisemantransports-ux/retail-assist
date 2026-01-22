# JSON Parsing Error - Debug Guide

## Current Status

**Error Observed:**
```
Failed to execute 'json' on 'Response': Unexpected end of JSON input
at handleSubmit (app/invite/invite-form.tsx:75:31)
```

**Root Cause:** Backend endpoint is returning an empty response body in some scenario.

## What We Fixed

### 1. Frontend - Now reads response as text first (invite-form.tsx)
```typescript
// OLD: Directly call response.json() - crashes on empty body
data = await response.json();

// NEW: Read as text, then parse - handles empty gracefully
const responseText = await response.text();
if (responseText) {
  data = JSON.parse(responseText);
} else {
  data = { success: false, error: 'Empty server response' };
}
```

### 2. Backend - Added logging to trace issue (route.ts)
```typescript
console.log('[/api/employees/accept-invite POST] Sending success response:', successResponse);
console.log('[/api/employees/accept-invite POST] Response created, returning...');
```

## How to Debug

### Step 1: Deploy Latest Code
The current code has extensive logging. Deploy to Vercel:
```bash
git push origin main
```

### Step 2: Open Vercel Logs
1. Go to: https://vercel.com/dashboard
2. Select `retail-assist` project
3. Go to "Deployments" tab
4. Click on latest deployment
5. Click "Logs" → "Runtime Logs"

### Step 3: Try the Invite Flow
1. Create a new invite as admin
2. Copy the invite link
3. Open in **incognito window**
4. Fill form and submit

### Step 4: Check Console Logs
In browser DevTools → Console, you'll see:
```
[InviteForm] Submitting invite acceptance: {...}
[InviteForm] Response status: 200
[InviteForm] Response content-type: application/json
[InviteForm] Response body length: 123
[InviteForm] Response body: {"success":true,...}
[InviteForm] Parsed response: {success: true, ...}
```

### Step 5: Check Backend Logs
In Vercel Runtime Logs, you'll see:
```
[/api/employees/accept-invite POST] Accepting invite: {token: "...", email: "..."}
[/api/employees/accept-invite POST] Sending success response: {success: true, workspace_id: "...", role: "employee"}
[/api/employees/accept-invite POST] Response created, returning...
```

## What Each Log Means

### Frontend Logs (In Browser Console)

| Log | Meaning |
|-----|---------|
| `Response status: 200` | Backend returned success HTTP code |
| `Response status: 400` | Backend rejected request (invalid data) |
| `Response status: 500` | Backend error |
| `Response body length: 0` | ⚠️ Backend returned empty body |
| `Response body: {"success":true,...}` | ✅ Normal response |
| `JSON parse error` | Body wasn't valid JSON |

### Backend Logs (In Vercel Runtime Logs)

| Log | Meaning |
|-----|---------|
| `Request body parse error` | Frontend sent malformed JSON |
| `Token is required` | Missing token in request |
| `Invalid or expired invite token` | Token not found in database |
| `Email does not match` | Frontend email != invite email |
| `Sending success response` | About to return success |
| `Response created, returning...` | Response object created successfully |

## Possible Scenarios

### Scenario 1: Empty Response Body (Most Likely)
**Symptoms:**
- Frontend: `Response body length: 0`
- Backend: Logs show `Sending success response` 
- Error: "Unexpected end of JSON input"

**Cause:** Response object created but body not serialized

**Fix:** Already applied - now reads as text first

**Verification:** Deploy and check if console shows `Response body: empty`

### Scenario 2: Invalid JSON from Backend
**Symptoms:**
- Frontend: `Response body: <invalid>` (not JSON)
- Error: "JSON.parse error"

**Cause:** Backend returning non-JSON

**Fix:** Already handled by try-catch

**Verification:** Check what `Response body` shows in console

### Scenario 3: Network/Proxy Issue
**Symptoms:**
- Response status is 0 or network error
- No response body
- Vercel logs show nothing

**Cause:** Request never reaches backend

**Fix:** Check network tab for failed requests

**Verification:** Network tab shows red X or status 0

### Scenario 4: Redirect Loop
**Symptoms:**
- Multiple requests in network tab
- Final response is HTML, not JSON
- Response length is thousands of bytes

**Cause:** Middleware redirecting to login

**Fix:** Middleware correctly excludes `/api/` routes, but verify

**Verification:** Network tab shows redirect chain

## Testing Checklist

- [ ] Deploy updated code to Vercel
- [ ] Create invite as admin
- [ ] Open invite link in incognito
- [ ] Open DevTools console
- [ ] Submit form
- [ ] Check all `[InviteForm]` logs appear
- [ ] Check console for no parse errors
- [ ] Verify redirect happens
- [ ] Check Vercel runtime logs for `[/api/...]` logs
- [ ] Confirm response body is not empty

## Quick Test Commands

If you have access to Vercel CLI:
```bash
# Get recent logs
vercel logs

# Or tail real-time logs
vercel logs --follow
```

## Next Actions

1. **Deploy:** Push latest code to Vercel
2. **Test:** Try invite flow with DevTools open
3. **Monitor:** Watch both browser console and Vercel logs
4. **Trace:** Find where response body becomes empty
5. **Fix:** If still failing, apply targeted fixes based on logs

## Response Format Reference

### Success (200 OK)
```json
{
  "success": true,
  "workspace_id": "uuid-here",
  "role": "employee"
}
```

### Error (400/403/500)
```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

## Common Debugging Command

Run this in browser console while testing:
```javascript
// Fetch the same request manually
fetch('/api/employees/accept-invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'YOUR_TOKEN_HERE',
    email: 'test@example.com',
    first_name: 'Test'
  })
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Headers:', Object.fromEntries(r.headers));
  return r.text();
})
.then(text => {
  console.log('Body:', text);
  console.log('Length:', text.length);
  if (text) console.log('Parsed:', JSON.parse(text));
});
```

---

The key insight: **We've wrapped the JSON parsing to handle empty responses gracefully**. When you test, the console logs will tell you exactly what the backend is sending. If it's empty, we'll need to trace why NextResponse.json() is not serializing the body properly.
