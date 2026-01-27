# V1 Auth Invite Acceptance - Code Changes Summary

## Modified Files

### 1. Accept-Invite Endpoint: `/app/api/employees/accept-invite/route.ts`

**Lines Changed:** 3-18 (JSDoc), 109-213 (Logic)

#### JSDoc Update
```typescript
/**
 * POST /api/employees/accept-invite
 * Accepts an employee invite token and links auth_uid to internal user row
 * 
 * v1 AUTH FLOW:
 * STEP 1 — Validate token input
 * STEP 2 — Lookup invite (ADMIN CLIENT)
 * STEP 3 — Check if user already exists by email
 *   - If exists: Update only auth_uid (if missing) and workspace_id (if provided)
 *     Preserve existing role (do NOT overwrite)
 *   - If not exists: 
 *     a) CREATE Supabase auth user (returns auth_uid)
 *     b) CREATE internal user row with auth_uid linked
 * STEP 4 — Mark Invite Accepted (LAST STEP)
 * STEP 5 — Return success with redirect to login
 * 
 * CRITICAL: auth_uid linkage is the key requirement for login to work.
 * The login endpoint uses auth_uid to find the internal user row.
 * Without proper auth_uid linkage, login will fail with "User not found (403)".
 */
```

#### Logic Changes
**STEP 3: Existing User Path**

Before:
```typescript
if (existingUser) {
  userId = existingUser.id;
  authUid = existingUser.auth_uid;
  
  // Update existing user with new workspace_id if needed
  const { error: updateError } = await admin
    .from('users')
    .update({
      workspace_id: invite.workspace_id,
      role: 'employee',  // ❌ This overwrites role
    })
    .eq('id', userId);
  // ... rest of error handling
}
```

After:
```typescript
if (existingUsers && existingUsers.length > 0) {
  // Handle multiple users with same email
  if (existingUsers.length > 1) {
    console.warn('[INVITE ACCEPT] Multiple users found with same email, using first one', {
      email: invite.email,
      count: existingUsers.length,
      user_ids: existingUsers.map(u => u.id),
    });
  }

  const existingUser = existingUsers[0];
  userId = existingUser.id;
  authUid = existingUser.auth_uid;

  console.log('[INVITE ACCEPT] User already exists (found by email):', {
    user_id: userId,
    existing_auth_uid: authUid,
    existing_role: existingUser.role,
    existing_workspace_id: existingUser.workspace_id,
  });

  // If user already has an auth_uid, use it; otherwise create new auth user
  if (!authUid) {
    // Create Supabase auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true,
    });

    if (authError || !authData?.user?.id) {
      // ... error handling
    }

    authUid = authData.user.id;
    console.log('[INVITE ACCEPT] New auth user created for existing internal user:', {
      user_id: userId,
      auth_uid: authUid,
    });
  } else {
    console.log('[INVITE ACCEPT] User already has auth_uid, no new auth user needed');
  }

  // Update existing user: preserve role and workspace, only update if not already set
  const updatePayload: any = {};
  
  // Only set workspace_id if the invite provides one (not null)
  if (invite.workspace_id) {
    updatePayload.workspace_id = invite.workspace_id;
  }
  
  // ✅ FIX: Only set auth_uid if we just created it or if it was missing
  if (authUid && !existingUser.auth_uid) {
    updatePayload.auth_uid = authUid;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await admin
      .from('users')
      .update(updatePayload)
      .eq('id', userId);

    if (updateError) {
      // ... error handling
    }

    console.log('[INVITE ACCEPT] Existing user updated:', {
      user_id: userId,
      auth_uid: authUid,
      updates: updatePayload,
    });
  } else {
    console.log('[INVITE ACCEPT] No updates needed for existing user:', {
      user_id: userId,
      auth_uid: authUid,
    });
  }
}
```

**STEP 3A & 3B: New User Path**

Before:
```typescript
} else {
  console.log('[INVITE ACCEPT] Creating new Supabase auth user');

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    // ...
  });

  authUid = authData.user.id;
  console.log('[INVITE ACCEPT] Auth user created', { auth_uid: authUid });

  console.log('[INVITE ACCEPT] Creating internal user row');

  const { data: newUser, error: userError } = await admin
    .from('users')
    .insert({
      auth_uid: authUid,  // ✅ This was already correct
      email: invite.email,
      role: 'employee',
      workspace_id: invite.workspace_id,
    })
    // ... rest
}
```

After:
```typescript
} else {
  // ============================================================
  // STEP 3A: NEW USER - CREATE SUPABASE AUTH USER
  // ============================================================
  console.log('[INVITE ACCEPT] No existing user found, creating new Supabase auth user');

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: invite.email,
    password: password,
    email_confirm: true,
  });

  if (authError || !authData?.user?.id) {
    console.error('[INVITE ACCEPT] Auth creation failed:', authError?.message);
    return NextResponse.json(
      { success: false, error: 'Failed to create user account' },
      { status: 500 }
    );
  }

  authUid = authData.user.id;
  console.log('[INVITE ACCEPT] Supabase auth user created', {
    email: invite.email,
    auth_uid: authUid,
  });

  // ============================================================
  // STEP 3B: NEW USER - CREATE INTERNAL USER ROW AND LINK auth_uid
  // ============================================================
  console.log('[INVITE ACCEPT] Creating internal user row linked to auth_uid');

  const { data: newUser, error: userError } = await admin
    .from('users')
    .insert({
      auth_uid: authUid,  // ✅ CRITICAL: Link auth_uid from the start
      email: invite.email,
      role: 'employee',
      workspace_id: invite.workspace_id,
    })
    .select('id')
    .single();

  if (userError) {
    // Handle duplicate constraint error gracefully
    if (userError.code === '23505' || userError.message?.includes('duplicate key')) {
      console.log('[INVITE ACCEPT] Concurrent insert detected. Re-querying by email...');
      
      // User was created by another concurrent request
      const { data: concurrentUsers } = await admin
        .from('users')
        .select('id, auth_uid, role, workspace_id')
        .eq('email', invite.email);

      if (concurrentUsers && concurrentUsers.length > 0) {
        const concurrentUser = concurrentUsers[0];
        userId = concurrentUser.id;
        
        // If the concurrent user doesn't have auth_uid set, update it to link this auth user
        if (!concurrentUser.auth_uid) {
          console.log('[INVITE ACCEPT] Linking auth_uid to concurrent user:', {
            user_id: userId,
            auth_uid: authUid,
          });

          const { error: updateError } = await admin
            .from('users')
            .update({ auth_uid: authUid })
            .eq('id', userId);

          if (updateError) {
            console.error('[INVITE ACCEPT] Failed to link auth_uid:', updateError?.message);
            return NextResponse.json(
              { success: false, error: 'Failed to link user account' },
              { status: 500 }
            );
          }

          console.log('[INVITE ACCEPT] Successfully linked auth_uid to internal user:', {
            user_id: userId,
            auth_uid: authUid,
          });
        } else {
          console.log('[INVITE ACCEPT] Concurrent user already has auth_uid:', {
            user_id: userId,
            existing_auth_uid: concurrentUser.auth_uid,
          });
        }

        // Update workspace if needed
        if (invite.workspace_id && (!concurrentUser.workspace_id || concurrentUser.workspace_id !== invite.workspace_id)) {
          const { error: workspaceError } = await admin
            .from('users')
            .update({ workspace_id: invite.workspace_id })
            .eq('id', userId);

          if (workspaceError) {
            console.warn('[INVITE ACCEPT] Failed to update workspace_id:', workspaceError?.message);
          } else {
            console.log('[INVITE ACCEPT] Updated workspace_id for concurrent user:', {
              user_id: userId,
              workspace_id: invite.workspace_id,
            });
          }
        }
      } else {
        console.error('[INVITE ACCEPT] Duplicate error but user not found by email');
        return NextResponse.json(
          { success: false, error: 'Failed to create user profile' },
          { status: 500 }
        );
      }
    } else {
      console.error('[INVITE ACCEPT] User row creation failed:', userError?.message);
      return NextResponse.json(
        { success: false, error: 'Failed to create user profile' },
        { status: 500 }
      );
    }
  } else if (!newUser) {
    console.error('[INVITE ACCEPT] User row creation returned no data');
    return NextResponse.json(
      { success: false, error: 'Failed to create user profile' },
      { status: 500 }
    );
  } else {
    userId = newUser.id;
    console.log('[INVITE ACCEPT] Successfully created and linked new user:', {
      user_id: userId,
      auth_uid: authUid,
      email: invite.email,
      role: 'employee',
      workspace_id: invite.workspace_id,
    });
  }
}
```

---

### 2. ensureInternalUser() in `/app/lib/supabase/queries.ts`

**Lines Changed:** 57-172 (Complete function rewrite)

**Key Changes:**

1. **Updated JSDoc** (lines 57-75):
   - Added v1 auth requirements
   - Documented read-only behavior
   - Explained role validation requirement
   - Noted no auto-creation allowed

2. **Mock Mode Logic** (lines 77-125):
   - Added auth_uid lookup
   - Added role validation at each step
   - Updated Supabase fallback with workspace_id
   - Fixed error messages with (403) indicator
   - Throw errors instead of returning null

3. **Supabase Mode Logic** (lines 127-172):
   - Changed from creation to read-only
   - Proper error handling with (403) for missing users
   - Role validation at each lookup
   - Clear logging with auth_uid information
   - Single 500ms retry for auth trigger delays

**Before (Allows auto-creation):**
```typescript
export async function ensureInternalUser(candidateId: string | null | undefined): Promise<{ id: string | null }> {
    if (!candidateId) return { id: null }
    
    const db = admin()

    // If candidateId already matches an internal id, return it
    const { data: byId } = await db.from('users').select('id, role').eq('id', candidateId).maybeSingle()
    if (byId && (byId as any).id) {
        if (!(byId as any).role) {
            throw new Error(`User found but role is missing for auth_uid: ${candidateId}`)
        }
        console.info('[ensureInternalUser] Found by id:', candidateId, 'role:', (byId as any).role)
        return { id: (byId as any).id }
    }
    // ... rest tries to find user but has fallback creation logic
}
```

**After (Read-only, proper error handling):**
```typescript
export async function ensureInternalUser(candidateId: string | null | undefined): Promise<{ id: string | null }> {
    if (!candidateId) return { id: null }
    
    const db = admin()

    // 1) If candidateId is an internal id, look it up directly
    const { data: byId } = await db.from('users').select('id, role, auth_uid, workspace_id').eq('id', candidateId).maybeSingle()
    if (byId && (byId as any).id) {
        if (!(byId as any).role) {
            console.error('[ensureInternalUser] User found by id but role missing:', { user_id: candidateId })
            throw new Error(`User found but role is missing for id: ${candidateId} (403)`)
        }
        console.info('[ensureInternalUser] Found user by id:', candidateId, 'role:', (byId as any).role)
        return { id: (byId as any).id }
    }

    // 2) If candidateId is an auth_uid, look it up by auth_uid
    const { data: byAuth } = await db.from('users').select('id, role, auth_uid, workspace_id').eq('auth_uid', candidateId).maybeSingle()
    if (byAuth && (byAuth as any).id) {
        if (!(byAuth as any).role) {
            console.error('[ensureInternalUser] User found by auth_uid but role missing:', { auth_uid: candidateId, user_id: (byAuth as any).id })
            throw new Error(`User found but role is missing for auth_uid: ${candidateId} (403)`)
        }
        console.info('[ensureInternalUser] Found user by auth_uid:', candidateId, '-> id:', (byAuth as any).id, 'role:', (byAuth as any).role, 'workspace_id:', (byAuth as any).workspace_id)
        return { id: (byAuth as any).id }
    }

    // 3) Retry after 500ms
    console.warn('[ensureInternalUser] Auth trigger did not create row for auth_uid:', candidateId, '. Retrying after 500ms...')
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const { data: byAuthRetry } = await db.from('users').select('id, role, auth_uid, workspace_id').eq('auth_uid', candidateId).maybeSingle()
    if (byAuthRetry && (byAuthRetry as any).id) {
        if (!(byAuthRetry as any).role) {
            console.error('[ensureInternalUser] User found by auth_uid (after retry) but role missing:', { auth_uid: candidateId, user_id: (byAuthRetry as any).id })
            throw new Error(`User found but role is missing for auth_uid: ${candidateId} (403)`)
        }
        console.info('[ensureInternalUser] Found user by auth_uid after retry:', candidateId, '-> id:', (byAuthRetry as any).id, 'role:', (byAuthRetry as any).role, 'workspace_id:', (byAuthRetry as any).workspace_id)
        return { id: (byAuthRetry as any).id }
    }
    
    // 4) v1: User must exist. If not found, throw 403 error (no auto-creation)
    console.error('[ensureInternalUser] User not found for auth_uid:', candidateId)
    throw new Error(`User not found for auth_uid: ${candidateId} (403)`)
}
```

---

### 3. package.json

**Scripts Added:**
```json
"test:invite-acceptance:v1": "npx ts-node -r tsconfig-paths/register test-invite-acceptance-flow-v1.ts",
"test:invite-acceptance:verify": "npx ts-node -r tsconfig-paths/register test-invite-acceptance-verify.ts",
```

---

## Summary of Changes

| Component | Type | Status |
|-----------|------|--------|
| Accept-invite endpoint | Logic | ✅ Fixed to link auth_uid |
| ensureInternalUser() | Logic | ✅ Updated to read-only with proper error handling |
| JSDoc comments | Docs | ✅ Updated with v1 requirements |
| Test scripts | Config | ✅ Added 2 new tests |
| Overall logging | Observability | ✅ Enhanced with auth_uid tracking |

---

## What Each Change Accomplishes

1. **Accept-Invite Endpoint:**
   - Ensures auth_uid is set during user creation
   - Handles existing users by linking their auth_uid
   - Proper logging for debugging

2. **ensureInternalUser():**
   - Enables login to work by finding users by auth_uid
   - Enforces role validation
   - Prevents auto-creation during login
   - Throws proper 403 errors

3. **Tests & Docs:**
   - Verify the fix works
   - Guide future developers
   - Help troubleshoot issues

---

**All changes complete and ready for testing** ✅
