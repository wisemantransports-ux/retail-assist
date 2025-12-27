# Quick Reference: Fixed Data Flow

## The Problem
```
❌ WRONG: Using auth.user.id directly
.eq('owner_id', session.user.id)

Why? Because:
- auth.user.id exists in auth.users (Supabase)
- workspaces.owner_id references public.users.id (different table)
- They are the SAME UUID value, but querying the wrong source
```

## The Solution
```
✅ RIGHT: Two-step lookup
1. Get users.id from public.users where id = auth.user.id
2. Use that users.id to query workspaces
```

## Implementation Pattern

```typescript
// 1. Get session
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('Unauthorized');

// 2. Query public.users using auth.user.id
const { data: userRecord } = await supabase
  .from('users')
  .select('id')
  .eq('id', session.user.id)  // ← auth.user.id
  .single();

if (!userRecord) throw new Error('User not found');

// 3. Query workspaces using users.id
const { data: workspace } = await supabase
  .from('workspaces')
  .select('*')
  .eq('owner_id', userRecord.id)  // ← users.id
  .single();

// 4. Query agents using workspace.id
const { data: agents } = await supabase
  .from('agents')
  .select('*')
  .eq('workspace_id', workspace.id);

// 5. Validate membership
const { data: member } = await supabase
  .from('workspace_members')
  .select('role')
  .eq('workspace_id', workspace.id)
  .eq('user_id', userRecord.id)  // ← users.id again
  .single();
```

## Files Modified
1. **test-supabase.js** - Test script with correct flow
2. **app/api/auth/login/route.ts** - Auto-creates users record on auth sign-in
3. **app/api/agents/route.ts** - GET & POST methods use correct data flow
4. **app/dashboard/inbox-automation/new/page.tsx** - Fetches workspace correctly

## What NOT to Change
- ❌ DO NOT modify database schema
- ❌ DO NOT change RLS policies
- ❌ DO NOT rename table columns

## Testing
```bash
# Test the auth and workspace flow
node test-supabase.js
```

Expected output:
```
1️⃣ Signing in as admin...
✅ Signed in. Auth UID: <uuid>

2️⃣ Fetching user from public.users table...
✅ Found user record. User ID: <uuid>

3️⃣ Fetching workspaces...
Workspaces: [{ id: <uuid>, name: '...' }]

4️⃣ Fetching agents for workspace...
Agents: [{ id: <uuid>, name: '...' }]

5️⃣ Checking workspace membership...
Membership: { role: 'owner' }

6️⃣ Attempting to create agent as authenticated user (RLS test)...
Expected RLS block: [error message]
```
