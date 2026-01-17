# Employee Access - Quick Reference Card

**Print This & Keep Handy** 📋

---

## The 4 Roles at a Glance

```
┌──────────────────┬──────────────────────┬──────────────────┐
│ Role             │ Route                │ Workspace        │
├──────────────────┼──────────────────────┼──────────────────┤
│ super_admin      │ /admin               │ NULL             │
│ platform_staff   │ /admin/support       │ Platform WS      │
│ admin (client)   │ /dashboard           │ Client WS        │
│ employee         │ /employees/dashboard │ Assigned Client  │
└──────────────────┴──────────────────────┴──────────────────┘
```

---

## Key Invariants (MUST BE TRUE)

- ✅ Employee in EXACTLY ONE workspace
- ✅ Employee cannot be admin too
- ✅ Employee has workspace_id (never NULL)
- ✅ Middleware enforces route access
- ✅ API validates workspace_id matches
- ✅ Database prevents violations

---

## Who Can Invite Whom

```
super_admin  → platform_staff to Platform WS ✓
super_admin  → employee to any client WS ✓
admin        → employee to own WS ✓
employee     → nobody ✗
```

---

## Login Flow (5 steps)

```
1. User enters email + password at /login
2. Supabase Auth validates credentials
3. Backend calls rpc_get_user_access()
4. RPC returns (user_id, workspace_id, role)
5. Redirect based on role:
   - super_admin → /admin
   - platform_staff → /admin/support
   - admin → /dashboard
   - employee → /employees/dashboard
```

---

## Employee Access Control (3 layers)

```
Layer 1: Middleware (Route Control)
├─ Validates: role === 'employee'
├─ Validates: workspace_id exists
├─ Blocks: /admin, /dashboard
└─ Allows: /employees/dashboard/* only

Layer 2: API (Data Validation)
├─ Calls: rpc_get_user_access()
├─ Validates: workspace_id from RPC matches request
├─ Returns: 403 Forbidden if mismatch
└─ Filters: Queries by workspace_id

Layer 3: Database (Enforcement)
├─ UNIQUE(user_id) prevents multi-workspace
├─ TRIGGER prevents admin+employee dual
└─ RLS policies enforce data isolation
```

---

## Invite Flow (4 steps)

```
Step 1: Admin Creates Invite
  → Admin clicks "Invite Employee"
  → Fills email address
  → Calls rpc_create_employee_invite()
  → RPC validates: admin of this workspace?
  → Creates invite with random token
  → Sends email with token

Step 2: Employee Receives Email
  → Email contains link: /invite?token=<token>
  → Token is 30-day secure token

Step 3: Employee Accepts Invite
  → Clicks email link
  → Fills form (name, phone, password)
  → Calls rpc_accept_employee_invite()
  → RPC validates: token valid? Already employee? Admin?
  → Creates employee record with workspace_id
  → Marks invite as accepted
  → Logs to audit trail

Step 4: Employee Logs In
  → Goes to /login
  → Uses email + new password
  → Middleware redirects to /employees/dashboard
  → Can only see their workspace
```

---

## Files to Know

### Configuration
- `middleware.ts` - Route protection (lines 163-211)
- `next.config.ts` - Build configuration

### Database
- `supabase/migrations/030_*.sql` - Employee tables
- `supabase/migrations/032_*.sql` - Invite creation
- `supabase/migrations/033_*.sql` - Invite acceptance
- `supabase/migrations/035_*.sql` - Constraints & RLS

### Documentation
- `EMPLOYEE_ACCESS_SUMMARY.md` - Quick overview
- `EMPLOYEE_ACCESS_IMPLEMENTATION.md` - Complete guide
- `EMPLOYEE_ACCESS_TESTING.md` - Test cases
- `EMPLOYEE_ACCESS_DEPLOYMENT_GUIDE.md` - Deployment

---

## Common Tasks

### Check Employee's Workspace
```sql
SELECT workspace_id FROM employees WHERE user_id = '<uuid>';
```

### Check All Employees in Workspace
```sql
SELECT * FROM employees WHERE workspace_id = '<ws-uuid>';
```

### Check Pending Invites
```sql
SELECT * FROM employee_invites WHERE status = 'pending' AND expires_at > NOW();
```

### Check RPC Works
```sql
SELECT * FROM rpc_get_user_access();
```

### Verify Single Workspace
```sql
-- Should be empty (no multi-workspace users)
SELECT user_id, COUNT(*) FROM employees GROUP BY user_id HAVING COUNT(*) > 1;
```

---

## Endpoints (To Be Implemented)

```
GET  /api/employees/dashboard/messages
GET  /api/employees/dashboard/messages/{id}
POST /api/employees/dashboard/messages/{id}
GET  /api/employees/dashboard/metrics
GET  /api/employees/dashboard/profile
POST /api/auth/invite/accept
```

---

## API Endpoint Pattern (Standard)

```typescript
export async function GET(request: NextRequest) {
  // 1. Authenticate user
  const user = await getUser();
  if (!user) return 401;
  
  // 2. Get role + workspace from RPC
  const { role, workspace_id } = await rpc_get_user_access();
  
  // 3. Validate: Is employee?
  if (role !== 'employee') return 403;
  
  // 4. Validate: workspace_id matches
  if (request.params.workspace_id !== workspace_id) return 403;
  
  // 5. Query with workspace filter
  const data = await db.query(
    'SELECT * FROM table WHERE workspace_id = $1',
    [workspace_id]
  );
  
  // 6. Return data
  return json(data);
}
```

---

## Error Messages

### 401 Unauthorized
- No user logged in
- Session expired
- RPC failed

### 403 Forbidden
- Role doesn't allow access
- workspace_id doesn't match
- Not authorized to perform action

### 400 Bad Request
- Invalid token
- Already accepted invite
- User already employee

### 404 Not Found
- Resource doesn't exist
- (Note: Use 403 for workspace mismatch, not 404!)

---

## Security Checklist

- [ ] UNIQUE(user_id) constraint active
- [ ] TRIGGER preventing dual roles
- [ ] RLS policies enforced
- [ ] Middleware validates routes
- [ ] API validates workspace_id
- [ ] Invite tokens secure (random 128-bit)
- [ ] 30-day expiry on invites
- [ ] No workspace_id in URL (use RPC)
- [ ] Return 403 on access denial, not 404
- [ ] Audit logging active

---

## Testing Quick Commands

```bash
# Test login flow
npm test -- EMPLOYEE_ACCESS_TESTING.md

# Test RPC functions
psql $DATABASE_URL < test-rpc.sql

# Test middleware
npm run dev # and visit /employees/dashboard

# Test cross-workspace prevention
curl -H "Authorization: Bearer $TOKEN" \
  /api/employees/dashboard/messages?workspace_id=wrong-workspace
# Should get 403 Forbidden
```

---

## Troubleshooting

### Employee redirected to /unauthorized
**Cause**: rpc_get_user_access returns no role
**Fix**: Check employees table has correct record with workspace_id

### UNIQUE constraint violation on invite acceptance
**Cause**: User already in different workspace
**Fix**: RPC should prevent this; check migration 035 applied

### Admin sees "can only invite to own workspace"
**Cause**: Admin.workspace_id ≠ invite workspace_id
**Fix**: Verify admin actually has access to that workspace

### Middleware redirect loop
**Cause**: Role not returned from RPC
**Fix**: Check session is valid and rpc_get_user_access working

---

## Contact & Resources

**For Quick Questions**:
- [EMPLOYEE_ACCESS_SUMMARY.md](EMPLOYEE_ACCESS_SUMMARY.md) - 5 min read

**For Details**:
- [EMPLOYEE_ACCESS_IMPLEMENTATION.md](EMPLOYEE_ACCESS_IMPLEMENTATION.md) - Complete guide

**For Deployment**:
- [EMPLOYEE_ACCESS_DEPLOYMENT_GUIDE.md](EMPLOYEE_ACCESS_DEPLOYMENT_GUIDE.md) - Step-by-step

**For Testing**:
- [EMPLOYEE_ACCESS_TESTING.md](EMPLOYEE_ACCESS_TESTING.md) - 15 test cases

**For Next Steps**:
- [EMPLOYEE_ACCESS_NEXT_STEPS.md](EMPLOYEE_ACCESS_NEXT_STEPS.md) - Remaining work

---

## Version Info

| Component | Version | Status |
|-----------|---------|--------|
| DB Schema | 035 | ✅ Complete |
| RPC | 029 | ✅ Complete |
| Middleware | v1.0 | ✅ Complete |
| Documentation | v1.0 | ✅ Complete |
| API | v0.0 | ⏳ Pending |
| Frontend | v0.0 | ⏳ Pending |

---

**Last Updated**: January 16, 2026
**Ready for**: Printing & Daily Reference
