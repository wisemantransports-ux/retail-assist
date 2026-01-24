# Employee Invite Acceptance - Quick Reference

## Endpoints

### 1️⃣ Accept Invite (Main)
```
POST /api/employees/accept-invite?token=<UUID>

Body:
{
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "password": "SecurePassword123"
}

Success (200):
{
  "success": true,
  "user_id": "<uuid>",
  "workspace_id": "<uuid or null>",
  "role": "employee",
  "message": "Invite accepted successfully"
}

Error (400):
{
  "success": false,
  "error": "Invalid or expired invite token"
}
```

### 2️⃣ Preview Invite (New)
```
GET /api/employees/invite-preview?token=<UUID>

Success (200):
{
  "email": "user@example.com",
  "workspace_id": "<uuid or null>",
  "status": "pending",
  "expires_at": null
}

Error (400):
{
  "error": "Invalid or expired invite token"
}
```

## 6-Step Flow

```
STEP 1: Validate token from URL
   ↓
STEP 2: Lookup invite (status must be 'pending')
   ↓
STEP 3: Create Supabase auth user
   ↓
STEP 4: Create internal users table row
   ↓
STEP 5: Mark invite accepted (LAST - after user created)
   ↓
STEP 6: Return success (no auto-login)
```

## Key Points

✅ **Admin client only** - No anon client for invite queries  
✅ **Token from URL** - `?token=<UUID>`, not in body  
✅ **Status check** - Must be 'pending' before accepting  
✅ **Order matters** - Invite lookup → Auth user → DB row → Mark accepted  
✅ **No inviter check** - Spec doesn't require it  
✅ **No employee table** - Only create users table row  
✅ **No expiration math** - Status is source of truth  

## Files Modified

| File | Changes |
|------|---------|
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts) | Refactored to 6-step flow (197 lines) |
| [app/api/employees/invite-preview/route.ts](app/api/employees/invite-preview/route.ts) | NEW endpoint for preview |
| [app/invite/invite-form.tsx](app/invite/invite-form.tsx) | No changes needed |

## Database Schema Used

### employee_invites table
- `id` - UUID primary key
- `token` - UUID v4 (raw, not hashed)
- `email` - User email
- `workspace_id` - Nullable (null = platform level)
- `status` - 'pending' | 'accepted' | 'revoked' | 'expired'
- `accepted_at` - ISO timestamp (set when accepted)
- `created_at` - ISO timestamp

### users table
- `id` - UUID primary key
- `auth_uid` - Supabase auth UID
- `email` - User email
- `role` - 'employee' | 'admin' | 'super_admin'
- `workspace_id` - Nullable

## Logging

All logs use `[INVITE ACCEPT]` prefix:

```
[INVITE ACCEPT] token received
[INVITE ACCEPT] invite lookup starting
[INVITE ACCEPT] invite found: true/false
[INVITE ACCEPT] Creating Supabase auth user
[INVITE ACCEPT] Auth user created
[INVITE ACCEPT] Creating internal user row
[INVITE ACCEPT] User row created
[INVITE ACCEPT] Marking invite as accepted
[INVITE ACCEPT] Invite marked as accepted
```

## Error Responses

All errors use:
```json
{
  "success": false,
  "error": "Invalid or expired invite token"
}
```

Except:
- `400` - Invalid token, token not found, status not pending
- `500` - Auth creation failed, user row creation failed

## Build Status

```
✓ Compiled successfully
✓ /api/employees/accept-invite
✓ /api/employees/invite-preview
✓ 0 errors
```

## Ready to Test

1. Create invite via `/api/platform-employees`
2. Load preview via `/api/employees/invite-preview?token=...`
3. Submit form to `/api/employees/accept-invite?token=...`
4. Verify: auth user created, users row created, invite marked accepted
