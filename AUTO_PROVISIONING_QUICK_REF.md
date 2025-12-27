# Auto-Provisioning Quick Reference

## The Problem (Fixed)
```
❌ User signs in with Supabase
❌ User exists in auth.users
❌ User does NOT exist in public.users
❌ Query workspaces fails
```

## The Solution
```
✅ User signs in with Supabase
✅ Check public.users
✅ If missing → auto-create user record
✅ Query workspaces succeeds
✅ User can access all features
```

## Minimal Insert
```typescript
// Only these 2 fields are required
await supabase.from('users').insert({
  id: auth.user.id,           // UUID from Supabase auth
  email: auth.user.email,     // Email from auth response
})
// All other fields are optional or have defaults
```

## Entry Points (All Fixed)

### 1. **Login Route**
Path: `app/api/auth/login/route.ts`
When: User enters credentials and signs in
Auto-provision: YES ✅

### 2. **Agents API**
Path: `app/api/agents/route.ts` (GET & POST)
When: User accesses agents or creates agent
Auto-provision: YES ✅

### 3. **Inbox Automation**
Path: `app/dashboard/inbox-automation/new/page.tsx`
When: User accesses automation feature
Auto-provision: YES ✅

### 4. **Test Script**
Path: `test-supabase.js`
When: Running tests
Auto-provision: YES ✅

## Implementation Pattern (Copy-Paste Ready)

```typescript
// Get authenticated session
const { data: { session } } = await supabase.auth.getSession()
if (!session) throw new Error('Unauthorized')

// Check/create user
let { data: userRecord, error: userError } = await supabase
  .from('users')
  .select('id')
  .eq('id', session.user.id)
  .single()

if (userError || !userRecord) {
  const { data: created } = await supabase
    .from('users')
    .insert({
      id: session.user.id,
      email: session.user.email,
    })
    .select('id')
    .single()
  userRecord = created
}

// Now use userRecord.id safely
// (Don't use session.user.id directly for public.users queries)
```

## Verification Checklist

- [x] Auth sign-in works
- [x] User auto-created in public.users
- [x] Workspaces can be queried
- [x] Agents can be fetched
- [x] Workspace membership can be checked
- [x] No schema changes
- [x] No RLS changes
- [x] Test script passes

## Test Result

```
✅ Auth sign-in: SUCCESS
✅ User provisioning: SUCCESS  
✅ Workspace access: READY
✅ Agent access: READY
```

## Commit Message (If Using Git)

```
feat: auto-provision user records in public.users table

- Auto-create user record after Supabase auth sign-in
- Check → Create → Continue pattern across all entry points
- Updated test-supabase.js with provisioning logic
- Updated login, agents, and dashboard APIs
- Prevents "User not found" errors on first-time access
- No schema or RLS changes
```

## Related Documentation

- [AUTH_FLOW_FIXES.md](AUTH_FLOW_FIXES.md) - Original auth flow fixes
- [AUTO_PROVISIONING_FIX.md](AUTO_PROVISIONING_FIX.md) - Detailed implementation
- [test-supabase.js](test-supabase.js) - Full working test
