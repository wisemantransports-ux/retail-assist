# Dashboard Redirect Fix - Summary

## Problem
The F-4 E2E test was failing with:
- ✅ HTTP 200 response from `/api/auth/signup`
- ✅ Session cookie was created
- ❌ Redirect to `/dashboard` failed - instead redirected to `/auth/login`
- ❌ `/api/auth/me` returned 401 "User not found"

## Root Cause
The internal user ID was being stored in the session, but the corresponding user row didn't actually exist in the `public.users` table when `/api/auth/me` tried to look it up.

### Why?
1. Auth user is created in `auth.users` table via Supabase Auth
2. The auth trigger `handle_new_auth_user` should create a row in `public.users` with `auth_uid` set
3. However, there can be a race condition OR RLS policy issues preventing this
4. `ensureInternalUser()` was called to find/create the user, but it would return an ID that wasn't actually persisted
5. Session was created with a non-existent `user_id`
6. `/api/auth/me` tried to find the user and failed

## Solution
Updated `ensureInternalUser()` in [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts) with:

### 1. Mock Mode Support (for dev environments)
- When `NEXT_PUBLIC_USE_MOCK_SUPABASE=true`, directly writes to `tmp/dev-seed/database.json`
- Ensures deterministic user creation in local development

### 2. Retry Logic with Delay
- Added 500ms retry after auth trigger check
- Handles race conditions where trigger hasn't fired yet
- Logs warning if retry is needed

### 3. Comprehensive Logging
Each step now logs:
- When user is found by ID
- When user is found by auth_uid
- When retry is triggered
- When insert/upsert fails and why
- When fallback select succeeds
- When all fallbacks fail

### 4. Verification
- Added final fallback select to verify the user row actually persists before returning
- Returns `{ id: null }` if verification fails (prevents session creation with invalid user_id)

### 5. Fallback in db.users.findById (dev mode)
- Added auth_uid lookup as fallback in `db.users.findById()`
- Helps if user was created with auth_uid but ID lookup fails

## Files Changed
1. **[app/lib/supabase/queries.ts](app/lib/supabase/queries.ts)** - Enhanced `ensureInternalUser()`
   - Added mock mode file-based persistence
   - Added retry logic with delay
   - Added verification before returning
   - Added detailed logging

2. **[app/lib/db/index.ts](app/lib/db/index.ts)** - Enhanced `db.users.findById()`
   - Added auth_uid fallback lookup in dev/mock mode

3. **[app/api/auth/signup/route.ts](app/api/auth/signup/route.ts)** - Added logging
   - Logs the ensureInternalUser call and result

## How to Test
1. Start the dev server: `npm run dev`
2. Test signup via the form or curl:
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-'$(date +%s)'@example.com",
    "password": "testpass123",
    "business_name": "Test",
    "phone": "+1555000"
  }'
```

3. Check server logs for `[ensureInternalUser]` entries confirming user creation
4. Use the session cookie to call `/api/auth/me` - should now return user data instead of 401

## Expected Log Output
```
[SIGNUP] Calling ensureInternalUser with auth UID: 8ebadd92-2e47-4b8c-92b6-c52b3ddc1688
[ensureInternalUser] Found by auth_uid: 8ebadd92-... -> id: 67702302-6903-4e92-ade3-20cd4431c864
[SIGNUP] ensureInternalUser returned: { id: '67702302-6903-4e92-ade3-20cd4431c864' }
[SIGNUP] Session created for user: 67702302-6903-4e92-ade3-20cd4431c864
```

Then when accessing `/api/auth/me`:
```
[Auth Me] Cookie header present: YES
[Auth Me] session_id cookie present: YES
[Auth Me] session lookup: FOUND
[Auth Me] user lookup: FOUND
```

## Backward Compatibility
✅ All changes are non-breaking:
- Production Supabase flow unchanged (just better logging and retries)
- Migrations not touched
- RPC contracts unchanged
- Database schema unchanged

## Next Steps
1. Re-run F-4 E2E test and confirm full success
2. Monitor production logs for auth trigger issues
3. If race conditions still occur, consider increasing the retry delay to 1000ms
