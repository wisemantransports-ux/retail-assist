# V1 Auth - Quick Reference Guide

## The Fix in 30 Seconds

**Problem:** Users accept invites but can't log in ("user not found")

**Root Cause:** `auth_uid` not linked to internal users row

**Solution:** Update accept-invite endpoint to link `auth_uid`:
```typescript
// When user accepts invite:
1. Create Supabase auth user → get auth_uid
2. Create/Update internal users row → SET auth_uid
3. Login works! ✅
```

---

## Testing

```bash
# Test the flow
npm run test:invite-flow:safe

# Expected: All 6 tests pass ✅
```

---

## Key Files Changed

1. **[app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts)**
   - Links auth_uid during invite acceptance

2. **[app/lib/supabase/queries.ts](app/lib/supabase/queries.ts) (lines 57-172)**
   - ensureInternalUser() now reads by auth_uid
   - Throws 403 if user not found

---

## Login Flow (Now Fixed)

```
POST /api/auth/login

Supabase.auth.signInWithPassword()
  ↓
ensureInternalUser(auth.user.id)
  ├─ Query: SELECT * FROM users WHERE auth_uid = ?
  └─ Return: { id: internal_user_id }
  ↓
Success! ✅
```

---

## Data Requirements

```sql
users table must have:
- id (primary key)
- auth_uid ← MUST BE SET for users who accepted invite
- email
- role (required)
- workspace_id (optional)
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "User not found (403)" on login | Check: is auth_uid linked? `SELECT auth_uid FROM users WHERE email='...'` |
| "Role not found (403)" on login | Check: is role set? `SELECT role FROM users WHERE id='...'` |
| Invite shows "user not found" | Verify invite exists and token is valid |

---

## Verification

✅ auth_uid is set for all accepted invites
✅ role is set for all users
✅ Login succeeds with correct redirect
✅ No user_id exposed in API responses

---

**Status:** ✅ Ready  
**Test Command:** `npm run test:invite-flow:safe`  
**Docs:** See [DELIVERY_SUMMARY.md](DELIVERY_SUMMARY.md)
