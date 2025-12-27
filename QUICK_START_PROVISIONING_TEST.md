# Quick Start: Testing Workspace Provisioning & RLS

## 30-Second Setup

```bash
# 1. View RLS policies to apply
node scripts/fix-and-apply-rls.js

# 2. Apply the SQL in Supabase dashboard
# (Copy output → go to SQL Editor → paste → run)

# 3. Run the comprehensive test
node scripts/test-workspace-provisioning-and-rls.js
```

## What Each Script Does

| Script | Purpose | Frequency |
|--------|---------|-----------|
| `fix-and-apply-rls.js` | Generate safe RLS policies | Once (when setting up or fixing) |
| `test-workspace-provisioning-and-rls.js` | Full integration test | Before deploying |
| `run-tests.sh` | Reference guide | View only |

## Expected Output

✅ = Pass  
⚠️ = Warning (expected behavior)  
❌ = Fail (needs fix)

```
Auth Sign-in:           ✅ PASSED
User Provisioning:      ✅ PASSED
Workspace Creation:     ✅ PASSED
Membership Creation:    ✅ PASSED
Agent Listing:          ✅ PASSED
RLS SELECT Test:        ✅ PASSED (allowed as expected)
RLS INSERT Test (User): ⚠️  BLOCKED (expected if not admin)
Service-Role Bypass:    ✅ PASSED
Overall Status:         ✅ PASSED
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `infinite recursion detected` | Run `fix-and-apply-rls.js` to regenerate policies |
| `column X does not exist` | Check schema in Supabase → update test if needed |
| `User record not found` | Test auto-creates it; re-run if stuck |
| `RLS blocking my INSERT` | Verify user role is `admin` or `owner` in workspace_members |

## Full Documentation

See [RLS_TESTING_GUIDE.md](RLS_TESTING_GUIDE.md) for:
- Complete policy definitions
- Schema setup
- Integration with app code
- Production checklist

---

**Ready?** Run the test:
```bash
node scripts/test-workspace-provisioning-and-rls.js
```
