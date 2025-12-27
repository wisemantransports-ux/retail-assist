# Auth & Workspace Data Flow Fixes

## Issue
The database schema has `workspaces.owner` referencing `public.users.id`, NOT `auth.users.id`. The previous code was directly using `auth.user.id` to query workspaces, which fails because:
- `auth.user.id` = Supabase Auth UID (in auth.users table)
- `workspaces.owner` = references `public.users.id` (different table)

## Solution
Implemented a two-step lookup pattern:
1. **Auth sign-in** → get `auth.user.id`
2. **Query public.users** → use `auth.user.id` as the record's primary key to fetch the `users.id`
3. **Query workspaces** → use the fetched `users.id` to find workspaces via `owner_id`
4. **Fetch agents** → use `workspace_id` to find agents
5. **Validate membership** → ensure user has workspace_members entry

## Files Updated

### 1. [test-supabase.js](test-supabase.js)
- **Before**: Used `auth.user.id` directly to query workspaces with `owner` field
- **After**: 
  - Step 1: Sign in with auth
  - Step 2: Query `public.users` using `id = auth.user.id` to get user record
  - Step 3: Query workspaces using `owner_id = users.id`
  - Step 4: Fetch agents for workspace
  - Step 5: Check workspace membership with authenticated user

### 2. [app/api/agents/route.ts](app/api/agents/route.ts)
- **GET Method**:
  - Added lookup: `users.select('id').eq('id', session.user.id)`
  - Changed workspaces query from `eq('owner_id', session.user.id)` to `eq('owner_id', userRecord.id)`
  
- **POST Method**:
  - Added user record lookup before workspace operations
  - Updated workspace query to use `userRecord.id`
  - Fixed membership validation to use `userRecord.id`

### 3. [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
- **Added automatic user record creation**:
  - After successful Supabase auth sign-in, checks if user record exists in `public.users`
  - If not found, creates a new user record with:
    - `id`: auth.user.id (Supabase UID)
    - `email`: from auth response
    - `full_name`: from metadata or email prefix
  - This ensures every authenticated user has a corresponding record in `public.users` table

### 4. [app/dashboard/inbox-automation/new/page.tsx](app/dashboard/inbox-automation/new/page.tsx)
- Added user record lookup before workspace query
- Changed from `eq('owner_id', session.user.id)` to `eq('owner_id', userRecord.id)`

## Data Flow Diagram

```
┌─────────────────┐
│  Auth Sign-in   │
│  supabase.auth  │
└────────┬────────┘
         │ returns auth.user.id
         ▼
┌─────────────────────────────────┐
│ Query public.users              │
│ .eq('id', auth.user.id)         │
└────────┬────────────────────────┘
         │ returns users.id
         ▼
┌─────────────────────────────────┐
│ Query workspaces                │
│ .eq('owner_id', users.id)       │
└────────┬────────────────────────┘
         │ returns workspace
         ▼
┌─────────────────────────────────┐
│ Query agents                    │
│ .eq('workspace_id', workspace)  │
└────────┬────────────────────────┘
         │ returns agents
         ▼
┌─────────────────────────────────┐
│ Validate workspace_members      │
│ (user has access)               │
└─────────────────────────────────┘
```

## Schema Relationships
```
auth.users (Supabase Auth)
    │
    └─ id (UUID) ──┐
                   │
                   ▼
            public.users
            (id = auth.users.id)
                   │
                   └─ id (PK) ──┐
                                │
                                ▼
                          workspaces
                          (owner_id references users.id)
                                │
                                └─ id ──┐
                                        │
                                        ▼
                                agents (workspace_id)
```

## RLS (Row Level Security)
- **workspaces RLS**: Users can view workspaces where `owner_id = auth.uid()` OR they are in `workspace_members`
- **agents RLS**: Agents are protected by workspace access rules
- **No schema changes needed**: All fixes are in data flow logic only

## Testing
Run the fixed test script:
```bash
node test-supabase.js
```

Expected flow:
1. ✅ Sign in with Supabase auth
2. ✅ Fetch user from public.users
3. ✅ Fetch workspaces by owner_id
4. ✅ Fetch agents for workspace
5. ✅ Check workspace membership
6. ✅ Test RLS with authenticated user creating agent
