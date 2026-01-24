# Invite Acceptance Error Fix - Enhanced Diagnostics & Client Consolidation

**Date:** January 2026  
**Status:** ✅ UPDATED (Better error diagnostics + cleaner implementation)  
**Build:** ✅ PASSED (0 errors)

---

## Problem Reported

User encountered error when accepting invite:
```
[InviteForm] Error accepting invite: "Database error during token lookup"
```

This error occurs when the invite acceptance endpoint fails to read the `employee_invites` table during token validation.

---

## Root Cause Analysis

The token lookup was failing due to one of these reasons:
1. **Missing environment variable** - `SUPABASE_SERVICE_ROLE_KEY` not set in deployment
2. **RLS policy blocking** - Database permissions issue
3. **Table access issue** - Connection or schema problem
4. **Invalid service role key** - Misconfigured credentials

The original code provided generic error messages without enough diagnostic information.

---

## Fix Applied

### Part 1: Enhanced Error Diagnostics
Added detailed logging to help identify the root cause:

**Before:**
```typescript
return NextResponse.json(
  { success: false, error: 'Database error during token lookup' },
  { status: 500 }
);
```

**After:**
```typescript
console.error('[/api/employees/accept-invite POST] ❌ Token lookup database error:', {
  message: tokenCheckError.message,
  code: tokenCheckError.code,
  details: tokenCheckError.details,
  hint: tokenCheckError.hint,
  full_error: JSON.stringify(tokenCheckError),
  env_check: {
    has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    service_key_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
  },
});

// Additional checks for missing configuration
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  return NextResponse.json(
    { success: false, error: 'Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY' },
    { status: 500 }
  );
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  return NextResponse.json(
    { success: false, error: 'Server configuration error: Missing NEXT_PUBLIC_SUPABASE_URL' },
    { status: 500 }
  );
}

return NextResponse.json(
  { success: false, error: `Database error during token lookup: ${tokenCheckError.message || 'Unknown error'}` },
  { status: 500 }
);
```

### Part 2: Consolidate to Use Admin Client
Refactored to use `createAdminSupabaseClient()` for ALL database operations instead of mixing `supabaseService` and anon client:

**Before:**
```typescript
// Created separate service client for token lookup
const supabaseService = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { cookies: { ... } }
);

// Then used token lookup
const { data: tokenCheckData } = await supabaseService
  .from('employee_invites')
  .select(...)

// Later operations used anon or admin client...
```

**After:**
```typescript
// Single admin client for all operations
const admin = createAdminSupabaseClient();

// Token lookup with admin client
const { data: tokenCheckData } = await admin
  .from('employee_invites')
  .select(...)

// All subsequent operations use same admin client
const { data: inviterData } = await admin
  .from('users')
  .select(...)
```

### Benefits of Consolidation
- ✅ **Cleaner code** - Single client instantiation
- ✅ **Consistent pattern** - Matches usage in platform staff and db.users.getAll()
- ✅ **Better maintainability** - Easier to understand and modify
- ✅ **Proper abstraction** - `createAdminSupabaseClient()` handles all admin logic
- ✅ **Same functionality** - Both approaches use admin/service-role client

---

## File Modified

[/app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts)

### Changes Summary
1. **Lines 131-138**: Consolidated admin client creation at function start
2. **Line 155**: Changed token lookup to use `admin` instead of `supabaseService`
3. **Lines 169-205**: Enhanced error logging with detailed diagnostics
4. **Removed**: Duplicate admin client creation (was at line ~312)
5. **Updated**: All subsequent operations already using `admin` client

---

## How to Use the Enhanced Diagnostics

When the error occurs again, check the server logs for:

```
[/api/employees/accept-invite POST] ❌ Token lookup database error: {
  message: "...",
  code: "...",
  details: "...",
  hint: "...",
  env_check: {
    has_url: true/false,
    has_service_key: true/false,
    service_key_length: N
  }
}
```

### What to Look For

**If `has_service_key: false`:**
- Action: Set `SUPABASE_SERVICE_ROLE_KEY` environment variable in deployment
- Add to Vercel/production environment: `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`

**If `has_url: false`:**
- Action: Set `NEXT_PUBLIC_SUPABASE_URL` environment variable
- Add to environment: `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`

**If code is `PGRST116` or similar:**
- Action: Check RLS policies on `employee_invites` table
- Issue might be: Too restrictive RLS policy blocking even admin client
- Fix: Review RLS policy to allow service role access

**If message contains `FATAL` or connection error:**
- Action: Verify Supabase project is accessible
- Check: Is the project suspended or in maintenance?
- Verify: Service role key is for the correct Supabase project

---

## Testing the Fix

1. **Check server logs** after invite acceptance fails
2. **Look for enhanced error message** with full diagnostics
3. **Identify root cause** from the logged details
4. **Fix environment variables** or RLS policies as needed
5. **Test again** - Should now either work or provide clear error message

---

## Next Steps if Error Persists

### Step 1: Check Environment Variables
```bash
# Verify these are set in deployment environment:
echo $NEXT_PUBLIC_SUPABASE_URL  # Should print URL
echo ${SUPABASE_SERVICE_ROLE_KEY:0:10}...  # Should print first 10 chars
```

### Step 2: Test Direct Query
From Supabase dashboard:
```sql
-- Run as service role user to test access
SELECT id, token, status FROM public.employee_invites LIMIT 1;
```

### Step 3: Check RLS Policies
```sql
-- Check RLS policies on employee_invites table
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'employee_invites';
```

### Step 4: Review Auth
- Verify Supabase project has service role key enabled
- Check: Is service role marked as inactive?
- Ensure: Service role key is for current Supabase project (not old project)

---

## Build Verification

```bash
npm run build
```

**Result:** ✅ PASSED
- Route: `/api/employees/accept-invite` ✅
- 0 TypeScript errors
- 0 build warnings

---

## Related Documentation

- [Invite Acceptance RLS Fix](INVITE_ACCEPTANCE_RLS_FIX_COMPLETE.md) - Original fix that applies admin client
- [Platform Staff RLS Fix](PLATFORM_STAFF_RLS_FIX_COMPLETE.md) - Similar pattern for platform staff endpoints
- [Auth Authorization Flow](SUPER_ADMIN_AUTHORIZATION_FLOW_TRACE.md) - Comprehensive auth tracing

---

## Summary

✅ **Enhanced** error diagnostics to identify root cause when token lookup fails  
✅ **Consolidated** to use `createAdminSupabaseClient()` for cleaner code  
✅ **Added** configuration validation checks  
✅ **Improved** error messages with specific guidance  
✅ **Build** passes successfully

The enhanced diagnostics will now tell you exactly what the problem is when invite acceptance fails, making it easy to identify if it's missing environment variables, RLS policies, or a database connectivity issue.
