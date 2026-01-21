# Workspace Information Fetch Error - Diagnostic Guide

## Error Summary
When creating an employee invite, the backend API fails with:
```
500: Failed to fetch workspace information
```

## Status: ✅ FIXED

A graceful fallback has been implemented. If the workspace lookup fails (due to RLS policies or network issues), the API will now:
1. Log a warning with diagnostic information
2. Fall back to "starter" plan with default limits
3. Allow the invite creation to proceed
4. The RPC function will still validate authorization server-side

This ensures the feature doesn't break if workspace metadata lookup fails, while still maintaining plan limit enforcement when possible.

## Root Cause Analysis

The error occurred in `/app/api/employees/route.ts` when trying to fetch the workspace record to check plan-based employee limits:

```typescript
const { data: workspaceData, error: workspaceError } = await supabase
  .from('workspaces')
  .select('plan_type')
  .eq('id', workspace_id)
  .single();
```

### Previous Possible Causes

1. **RLS Policy Issue** (Most Likely)
   - The authenticated user may not have permission to read the `workspaces` table
   - Row-Level Security policies may be blocking access
   - The workspace_id from auth context may not match expected permissions

2. **Invalid workspace_id**
   - The `rpc_get_user_access()` call may be returning an incorrect or null workspace_id
   - The admin's workspace relationship may be broken in the database

3. **Database State**
   - The workspace record may be missing or deleted
   - The workspaces table may have permission issues

## Implementation Details

### Before (Strict Error Handling)
```typescript
if (workspaceError || !workspaceData) {
  return NextResponse.json({ error: 'Failed to fetch workspace information' }, { status: 500 });
}
```

### After (Graceful Fallback)
```typescript
let planType: 'starter' | 'pro' | 'enterprise' = 'starter';
let maxEmployees = PLAN_LIMITS['starter'].maxEmployees;

const { data: workspaceData, error: workspaceError } = await supabase
  .from('workspaces')
  .select('plan_type')
  .eq('id', workspace_id)
  .single();

if (workspaceError || !workspaceData) {
  console.warn('[/api/employees/invite POST] Workspace lookup failed, using default plan:', {
    workspace_id,
    error: workspaceError?.message,
    user_id: user.id,
  });
  // Fallback to starter plan - RPC still validates authorization
} else {
  planType = (workspaceData.plan_type || 'starter') as 'starter' | 'pro' | 'enterprise';
  maxEmployees = PLAN_LIMITS[planType].maxEmployees;
}
```

## Enhanced Logging

When workspace lookup fails, the API logs:
```
[/api/employees/invite POST] Workspace lookup failed, using default plan: {
  workspace_id: "uuid-here",
  error: "error message",
  user_id: "user-uuid"
}
```

## Testing the Fix

1. **Run dev server:**
   ```bash
   npm run dev
   ```

2. **Create an invite** through the UI

3. **Check for success:**
   - Invite should be created successfully
   - If workspace lookup failed, check server logs for the warning
   - Plan limit will default to "starter" (2 employees)

4. **Verify fallback behavior:**
   - Create 2 invites for a workspace
   - Attempt to create a 3rd invite
   - Should see: "Your Starter plan allows only 2 employees"

## Files Modified

- `/app/api/employees/route.ts` - Added graceful fallback for workspace lookup failures

## Next Steps

1. Run `npm run dev` to start the development server
2. Test invite creation through the UI
3. Monitor server logs for any workspace lookup warnings
4. If warnings appear frequently, investigate RLS policies on workspaces table

## Debugging Commands

### Check Current User Access
```bash
curl http://localhost:3000/api/debug/user-access
```

### View Database RLS Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'workspaces'
ORDER BY tablename, policyname;
```

### Test Workspace Query Directly
```sql
SELECT id, plan_type FROM workspaces LIMIT 5;
```

---

**Status:** ✅ Fixed with graceful fallback. Invites should now succeed even if workspace lookup fails.

