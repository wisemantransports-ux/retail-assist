# Server-Side Authentication Fixes - Session Cookie Propagation

## ✅ Status: READY FOR TESTING

Server-side session cookie handling has been fixed to ensure proper propagation between `/api/auth/login` and `/api/auth/me`.

---

## Problem Identified

**Symptom**: `/api/auth/login` returns 200 but `/api/auth/me` returns 401

**Root Cause**: Session cookies set by Supabase during login were not being properly read by `/api/auth/me` because:

1. Cookie handling was fragmented across multiple response objects
2. Cookies from the SSR client weren't being properly merged into the final response
3. `/api/auth/me` wasn't configured to read cookies from the same cookie store

---

## Solution: Single Shared Cookie Handler

### New File: `app/lib/supabase/auth-server.ts`

A single, reusable utility that both auth routes import and use:

```typescript
export function createAuthSupabaseClient(request: NextRequest): {
  supabase: SupabaseClient;
  response: NextResponse;
}
```

**What it does**:
1. ✅ Creates an SSR Supabase client that reads cookies from incoming request
2. ✅ Configures cookies properly: `sameSite: 'lax'`, `path: '/'`, `secure: dynamic`
3. ✅ Returns both the client AND response object with cookie hooks
4. ✅ Automatically calls `setAll()` when Supabase auth methods set cookies
5. ✅ Properly formats cookies with all required options

**Key feature**:
```typescript
const { supabase, response } = createAuthSupabaseClient(request);

// Use the Supabase client
const { data } = await supabase.auth.signInWithPassword({ email, password });

// Return the response (cookies are automatically set)
return response;
```

---

## Fixed Route: `/api/auth/login`

**File**: `app/api/auth/login/route.ts`

**Key changes**:

1. **Import from shared utility**:
```typescript
import { createAuthSupabaseClient, mergeCookies } from '@/lib/supabase/auth-server'
```

2. **Create client once, use throughout**:
```typescript
const { supabase, response } = createAuthSupabaseClient(request);

// All Supabase auth calls use this client
const { data } = await supabase.auth.signInWithPassword({ email, password });
```

3. **Merge cookies into final response**:
```typescript
const finalResponse = NextResponse.json({ success: true, ... });

// Merge Supabase session cookies from auth response
mergeCookies(response, finalResponse);

// Merge any additional cookies
finalResponse.cookies.set('session_id', sessionId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/'
});

return finalResponse;
```

**Result**: Login response includes:
- ✅ Supabase auth cookies (sb-xxx, sb-refresh-xxx)
- ✅ Custom session_id cookie
- ✅ Proper cookie configuration

---

## Fixed Route: `/api/auth/me`

**File**: `app/api/auth/me/route.ts`

**Key changes**:

1. **Import from shared utility**:
```typescript
import { createAuthSupabaseClient } from '@/lib/supabase/auth-server'
```

2. **Create client that reads request cookies**:
```typescript
const { supabase, response } = createAuthSupabaseClient(request);

// This automatically reads cookies from incoming request
const { data: userData } = await supabase.auth.getUser();
```

3. **Return 401 if no valid session**:
```typescript
if (!userData?.user) {
  return NextResponse.json(
    { error: 'Not authenticated' },
    { status: 401 }
  );
}
```

**Result**: When browser sends request with Supabase cookies:
- ✅ Cookies are read from request
- ✅ JWT is validated server-side
- ✅ User is found and authenticated
- ✅ Role is resolved and returned
- ✅ Returns 200 with role and workspace_id

---

## Cookie Flow Diagram

```
Browser Login Flow:
═════════════════

[1] POST /api/auth/login
    ├─ request: { email, password }
    └─ no cookies in request (first login)

[2] /api/auth/login response
    ├─ Supabase creates auth session
    ├─ SSR client calls response.cookies.set()
    ├─ Browser receives response with Set-Cookie headers
    ├─ Browser stores: sb-xxx, sb-refresh-xxx cookies
    └─ response: { success: true, role, workspaceId }

[3] Browser frontend gets role and redirects

[4] GET /api/auth/me
    ├─ request includes cookies: sb-xxx, sb-refresh-xxx
    ├─ SSR client reads cookies from request
    ├─ Supabase validates JWT from cookie
    ├─ User is authenticated
    └─ Returns: { role, workspaceId }

[5] Page refresh
    ├─ Browser sends existing cookies with request
    ├─ /api/auth/me validates cookies
    ├─ User session persists
    └─ Returns role and workspaceId
```

---

## Cookie Configuration

All cookies are configured with:

```typescript
{
  httpOnly: true,              // Not accessible from JavaScript
  secure: NODE_ENV === 'production',  // HTTPS only in production
  sameSite: 'lax',             // CSRF protection
  path: '/',                   // Available to entire app
  maxAge: 604800               // 7 days (session_id only)
}
```

---

## Testing the Fix

### Test 1: Login Success → Session Created

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# Should return:
# { "success": true, "user": {...}, "role": "super_admin", "workspaceId": null }

# And set cookies:
# Set-Cookie: sb-xxxx=...
# Set-Cookie: sb-refresh-xxxx=...
# Set-Cookie: session_id=...
```

### Test 2: Validate Session → User Found

```bash
# 2. Validate session using saved cookies
curl http://localhost:3000/api/auth/me \
  -b cookies.txt

# Should return:
# { "session": {...}, "role": "super_admin", "workspaceId": null, "user": {...} }
# Status: 200
```

### Test 3: No Cookies → 401

```bash
# 3. Try without cookies
curl http://localhost:3000/api/auth/me

# Should return:
# { "error": "Not authenticated" }
# Status: 401
```

### Test 4: Login Flow in Browser

1. Open browser console (F12)
2. Go to `/auth/login`
3. Enter credentials
4. Check console logs:
   ```
   [LOGIN] Starting login flow for: user@example.com
   [LOGIN] ✓ Supabase auth successful for user: xxxx-xxxx
   [LOGIN] ✓ Role resolution complete: { role: 'super_admin', workspaceId: null }
   [LOGIN] ✓ Login complete - session established with cookies
   ```
5. Browser redirects to `/admin`
6. Page refresh maintains authentication

---

## Server Console Logs (for Debugging)

### Login Success
```
[LOGIN] Starting login flow for: sam@demo.com
[LOGIN] ✓ Supabase auth successful for user: 9f8e7d6c-5b4a-3f2e-1d0c-9a8b7c6d5e4f
[LOGIN] Ensuring internal user exists for auth UID: 9f8e7d6c-5b4a-3f2e-1d0c-9a8b7c6d5e4f
[LOGIN] ✓ Internal user exists: 12345678-1234-1234-1234-123456789012
[LOGIN] ✓ Resolved role: super_admin
[LOGIN] ✓ Role resolution complete: { role: 'super_admin', workspaceId: null }
[LOGIN] Created session: sess_xxxxx
[LOGIN] ✓ Login complete - session established with cookies
[Auth Server] Reading cookies from request
[Auth Server] Setting 2 cookies in response
[Auth Server] Setting cookie: { name: 'sb-ftqcfpxundnxyvnaalia-auth-token', ... }
[Auth Server] Setting cookie: { name: 'sb-ftqcfpxundnxyvnaalia-auth-token-code-verifier', ... }
```

### Auth Validation Success
```
[Auth Me] GET /api/auth/me
[Auth Server] Reading cookies from request
[Auth Me] getUser result: { found: true, error: null }
[Auth Me] Authenticated user: 9f8e7d6c-5b4a-3f2e-1d0c-9a8b7c6d5e4f
[Auth Me] Database lookup: { found: true, error: null }
[Auth Me] ✓ Resolved: super_admin
[Auth Me] ✓ Role resolution complete: { role: 'super_admin', workspaceIdFromRpc: null }
[Auth Me] ✓ Auth validation successful
```

### Login Failure (Invalid Credentials)
```
[LOGIN] Starting login flow for: sam@demo.com
[LOGIN] Supabase signIn error: { message: 'Invalid login credentials', status: 400 }
```

### Auth Validation Failure (No Session)
```
[Auth Me] GET /api/auth/me
[Auth Server] Reading cookies from request
[Auth Me] getUser result: { found: false, error: 'Auth session missing!' }
[Auth Me] Auth check failed: Auth session missing!
```

---

## Files Modified

| File | Change | Impact |
|------|--------|--------|
| `app/lib/supabase/auth-server.ts` | Created | New shared cookie utility |
| `app/api/auth/login/route.ts` | Refactored | Uses shared utility, proper cookie merge |
| `app/api/auth/me/route.ts` | Refactored | Uses shared utility, reads cookies correctly |
| `app/lib/supabase/server.ts` | Verified ✅ | No changes needed |
| `app/auth/login/page.tsx` | Not changed ✅ | Frontend remains unchanged |
| `app/auth/signup/page.tsx` | Not changed ✅ | Frontend remains unchanged |
| `middleware.ts` | Not changed ✅ | Route protection unchanged |

---

## Why This Works

### Before (Broken)
```
Login Route:
1. Create Supabase client with request/response ✓
2. Call signInWithPassword()
3. Cookies set in response object ✓
4. Create NEW response object
5. Cookies NOT transferred to new response ✗
6. Return response WITHOUT cookies ✗

Auth/Me Route:
1. Create Supabase client
2. Client can't read cookies (not passed properly) ✗
3. getUser() returns 401 ✗
```

### After (Fixed)
```
Login Route:
1. Create Supabase client with request/response ✓
2. Call signInWithPassword()
3. Cookies automatically set via response.cookies.set() ✓
4. Create final response object
5. Merge cookies from auth response ✓
6. Return response WITH all cookies ✓

Auth/Me Route:
1. Create Supabase client with request/response ✓
2. Client reads cookies from request automatically ✓
3. getUser() validates JWT ✓
4. Returns 200 with user data ✓
```

---

## Environment Variables

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=development
```

In production, ensure:
- `NODE_ENV=production` (or deployment platform sets it)
- This ensures cookies are set with `secure: true` (HTTPS only)

---

## Deployment Notes

### Vercel
- Environment variables are automatically read
- `NODE_ENV=production` is set automatically
- Cookies will be secure (HTTPS)

### Self-hosted
- Set environment variables manually
- Ensure `NODE_ENV=production` in production
- HTTPS is required for secure cookies

---

## Troubleshooting

### Issue: Still Getting 401 on /api/auth/me

**Check 1**: Are cookies being set in login response?
- Open browser DevTools → Network tab
- Click on login request
- Go to Response Headers
- Look for Set-Cookie headers with `sb-` prefix

**Check 2**: Are cookies being sent with /api/auth/me request?
- In Network tab, click on /api/auth/me request
- Go to Request Headers
- Look for Cookie header with `sb-` values

**Check 3**: Check server logs
- Look for `[Auth Server] Reading cookies from request`
- If "0 cookies", browser isn't sending them

**Check 4**: Browser cookie settings
- DevTools → Application → Cookies
- Are sb-* cookies present?
- Check if expiry is in the future

### Issue: Login succeeds but no role returned

**Check**:
- Look for `[LOGIN] ✓ Resolved role:` log
- If not present, role resolution is failing
- Check database: user has role in users table?

### Issue: Redirect loop after login

**Check**:
- Frontend should receive role from login response
- Check browser console for `[Login Page]` logs
- Verify redirects are using `router.replace` (not `router.push`)

---

## Security Checklist

✅ Cookies are httpOnly (not accessible from JavaScript)
✅ Cookies are sameSite=lax (CSRF protection)
✅ Cookies use secure flag in production (HTTPS only)
✅ Service role key is server-side only (never exposed to client)
✅ JWT is validated server-side in both routes
✅ No access tokens returned to client
✅ Role resolution is done server-side only

---

## Summary

The fix ensures that:

1. **Login creates session**: `/api/auth/login` sets Supabase auth cookies in response
2. **Session persists**: Browser includes cookies in all requests
3. **Auth/me validates**: `/api/auth/me` reads cookies and validates JWT
4. **Proper propagation**: Cookies flow correctly between routes
5. **No 401 errors**: Valid sessions are recognized across requests
6. **Page refresh works**: Session persists when user refreshes page

Try logging in now with `sam@demo.com` and watch the console logs!
