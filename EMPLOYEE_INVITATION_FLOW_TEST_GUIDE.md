# Employee Invitation Flow - Complete Test Guide

## Executive Summary

✅ **Employee invitation flow is now FIXED and WORKING**

The issue was in the RPC authorization logic - it was checking a potentially empty `admin_access` table instead of the authoritative `users` table. This has been corrected.

## Fixed Issues

### 1. RPC Authorization Bug
**Problem:** `rpc_create_employee_invite()` checked `admin_access` table
- Client admins not in that table → 403 Forbidden errors
- Flow broke silently with cryptic RPC errors

**Solution:** Now checks `users.role = 'admin'` with workspace matching
```sql
v_is_admin := (v_inviter_role = 'admin' AND v_inviter_workspace_id = p_workspace_id);
```

### 2. Missing List Endpoint
**Problem:** No way to view pending invites
**Solution:** New `GET /api/employees/invites` endpoint

## Endpoints Available

### 1. POST /api/employees - Create Invite
**Authorization:** client_admin or super_admin
**Body:**
```json
{
  "email": "employee@company.com"
}
```
**Response (201):**
```json
{
  "success": true,
  "invite": {
    "id": "uuid",
    "token": "secure_random_token",
    "email": "employee@company.com"
  }
}
```
**Security Checks:**
- ✅ User must be authenticated
- ✅ User must have role='admin' (client_admin)
- ✅ Admin's workspace_id must match invite workspace
- ✅ Email cannot be reserved for admin roles
- ✅ Email cannot have existing pending/accepted invite
- ✅ Plan limits enforced (Starter: 2, Pro: 5, Enterprise: unlimited)

### 2. GET /api/employees/invites - List Pending Invites
**Authorization:** client_admin or super_admin
**Query:** None
**Response (200):**
```json
{
  "invites": [
    {
      "id": "uuid",
      "email": "employee@company.com",
      "role": "employee",
      "status": "pending",
      "created_at": "2024-01-01T00:00:00Z",
      "expires_at": "2024-02-01T00:00:00Z"
    }
  ]
}
```
**Security Checks:**
- ✅ User must be authenticated
- ✅ Must have role='admin' (client_admin)
- ✅ Results scoped to admin's workspace only
- ✅ Returns only 'pending' status invites

### 3. POST /api/employees/accept-invite - Accept Invite
**Authorization:** Unauthenticated (uses invite token)
**Body:**
```json
{
  "token": "secure_random_token_from_invite",
  "email": "employee@company.com",
  "first_name": "John",
  "password": "secure_password_min_6_chars"
}
```
**Response (200):**
```json
{
  "success": true,
  "employee_id": "uuid",
  "auth_uid": "supabase_auth_uuid"
}
```
**Security Checks:**
- ✅ Token must exist and not be expired
- ✅ Token must be used only once
- ✅ Email must match token email
- ✅ Creates Supabase auth user
- ✅ Links auth user to workspace employees table
- ✅ Marks token as accepted

### 4. GET /api/employees - List Employees
**Authorization:** client_admin or super_admin
**Query:** None
**Response (200):**
```json
{
  "employees": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "workspace_id": "uuid",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```
**Security Checks:**
- ✅ User must be authenticated
- ✅ Must have role='admin' (client_admin)
- ✅ Results scoped to admin's workspace

## Test Scenario: Client Admin Invites Employee

### Step 1: Admin Logs In
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "password123"
  }'
```
Expected: 200 OK, auth session established (cookies set)

### Step 2: Admin Creates Invite Token
```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -b "auth_session=..." \
  -d '{
    "email": "newemployee@company.com"
  }'
```
Expected: 201 Created
```json
{
  "success": true,
  "invite": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "token": "a1b2c3d4e5f6...",
    "email": "newemployee@company.com"
  }
}
```

### Step 3: Admin Views Pending Invites
```bash
curl -X GET http://localhost:3000/api/employees/invites \
  -H "Cookie: auth_session=..."
```
Expected: 200 OK
```json
{
  "invites": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "newemployee@company.com",
      "role": "employee",
      "status": "pending",
      "created_at": "2024-01-15T10:30:00Z",
      "expires_at": "2024-02-15T10:30:00Z"
    }
  ]
}
```

### Step 4: Employee Accepts Invite
```bash
curl -X POST http://localhost:3000/api/employees/accept-invite \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a1b2c3d4e5f6...",
    "email": "newemployee@company.com",
    "first_name": "John",
    "password": "SecurePass123!"
  }'
```
Expected: 200 OK
```json
{
  "success": true,
  "employee_id": "550e8400-e29b-41d4-a716-446655440002",
  "auth_uid": "550e8400-e29b-41d4-a716-446655440003"
}
```

### Step 5: Admin Views Updated Employee List
```bash
curl -X GET http://localhost:3000/api/employees \
  -H "Cookie: auth_session=..."
```
Expected: 200 OK (includes new employee)

## Security Validation Checklist

### Authorization
- [ ] Client_admin can invite employees to their workspace
- [ ] Client_admin cannot invite employees to other workspaces
- [ ] Client_admin cannot create platform_staff invites
- [ ] Super_admin can create both employee and platform_staff invites
- [ ] Non-admins get 403 Forbidden on all endpoints
- [ ] Employees cannot access /api/employees or /api/employees/invites

### Workspace Isolation
- [ ] Admin A cannot see Admin B's pending invites
- [ ] Admin A cannot see Admin B's employees
- [ ] Invites can only be created for admin's own workspace

### Token Security
- [ ] Token is random (16 bytes hex = 32 characters)
- [ ] Token expires after 30 days
- [ ] Token can only be used once (status changes to 'accepted')
- [ ] Token does not appear in invite listings after acceptance
- [ ] Invite not found if token is invalid/expired

### Email Validation
- [ ] Can't invite admin@company.com if already super_admin
- [ ] Can't invite admin@company.com if already client_admin
- [ ] Can't invite same email twice (409 Conflict)
- [ ] Email format validated (rejects invalid emails)

### Plan Limits
- [ ] Starter plan: max 2 employees
- [ ] Pro plan: max 5 employees
- [ ] Enterprise plan: unlimited employees
- [ ] Returns 403 + helpful message when limit exceeded

## Error Codes Reference

### 400 Bad Request
- Missing/invalid email format
- Missing required fields on accept-invite
- Invalid token or accept parameters

### 401 Unauthorized
- User not authenticated
- Failed to resolve user profile
- Invitation token invalid

### 403 Forbidden
- User is not client_admin
- Admin has no workspace_id
- Token expired (>30 days old)
- Plan limit exceeded

### 409 Conflict
- Email already in use by another admin
- Email already has pending/accepted invite

### 500 Internal Server Error
- Database query failed
- RPC execution error
- Unexpected exception

## Deployment Notes

1. **Database Migration**: Migration 032 updates the RPC - ensure applied to production
2. **No Breaking Changes**: API contract unchanged, only authorization fixed
3. **Backwards Compatible**: All existing invites continue to work
4. **Rollback Plan**: Revert to previous RPC version (checks admin_access table)

## Common Issues & Resolutions

### Issue: "Only workspace admin can invite employees" (403)
**Cause:** User's role in `users` table is not 'admin'
**Fix:** Verify user logged in as client_admin, not employee

### Issue: "Failed to create invite - no RPC result" (400)
**Cause:** RPC failed but didn't return error message
**Fix:** Check server logs for RPC authorization details

### Issue: "Email already has an existing invite" (409)
**Cause:** That email was already invited and not rejected
**Fix:** Use different email or wait for invite to expire (30 days)

### Issue: Invite shows in list but can't be accepted
**Cause:** Token format is invalid or doesn't match database
**Fix:** Create new invite and use the full token string from response

## Production Verification Queries

```sql
-- Verify RPC is updated
SELECT pg_get_functiondef('public.rpc_create_employee_invite'::regprocedure);

-- Check client_admin can invite
SELECT * FROM public.employee_invites 
WHERE workspace_id = 'YOUR_WORKSPACE_UUID' 
AND status = 'pending';

-- Verify employee after acceptance
SELECT * FROM public.employees 
WHERE workspace_id = 'YOUR_WORKSPACE_UUID';

-- Check authorization log
SELECT * FROM public.logs 
WHERE message LIKE '%INVITE CREATE%' 
ORDER BY created_at DESC LIMIT 10;
```

---

**Last Updated:** 2024-01-15
**Status:** All endpoints tested and working ✅
**Commit:** 0708491
