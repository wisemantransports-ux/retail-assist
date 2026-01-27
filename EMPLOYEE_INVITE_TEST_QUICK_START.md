# Employee Invite Flow Test - Quick Start Guide

## 30-Second Setup

```bash
# 1. Get auth token from browser
# Open the app in browser, log in as super_admin, then in console:
# document.cookie
# Copy the sb-dzrwxdjzgwvdmfbbfotn-auth-token value

# 2. Set token and run test
export TEST_AUTH_TOKEN="your_token_here"
npm run test:invite-flow

# Done! Check results below
```

## What Gets Tested

| Step | What it does | Success indicator |
|------|-------------|------------------|
| 1 | Create invite | "Invite created" message |
| 2 | Verify token in DB | "Token matches!" message |
| 3 | Accept invite | "Invite accepted" message |
| 4 | Check auth.users | "User found in auth.users" |
| 5 | Check users table | "User found in internal users table" |
| 6 | Clean up | "Cleanup completed" |

## Common Issues & Fixes

| Error | Solution |
|-------|----------|
| `TEST_AUTH_TOKEN not set` | Run: `export TEST_AUTH_TOKEN="your_token"` |
| `HTTP 401` | Token expired - get new one from browser |
| `HTTP 403` | Not a super_admin - use super_admin token |
| `Failed to connect` | Run `npm run dev` first |
| `Database error` | Check `.env.local` has correct keys |

## Files Created

```
test-employee-invite-flow.ts       Main test script (TypeScript)
run-invite-test.js                 Helper to run the test
EMPLOYEE_INVITE_TEST_README.md     Full documentation
EMPLOYEE_INVITE_TEST_QUICK_START.md (this file)
```

## What It Tests (In Detail)

### Invite Creation (Step 1)
✅ Generates random test email  
✅ Calls `/api/platform-employees` endpoint  
✅ Returns invite with token  

### Token Verification (Step 2)
✅ Token from response matches database  
✅ Invite status is "pending"  

### Invite Acceptance (Step 3)
✅ Calls `/api/employees/accept-invite` with token  
✅ Creates user in Supabase auth  
✅ Creates internal user record  

### Auth Verification (Step 4)
✅ User exists in `auth.users`  
✅ Email is verified  
✅ Auth UID matches  

### Internal User Verification (Step 5)
✅ User exists in `users` table  
✅ auth_uid is correct  
✅ Role is "employee"  

### Cleanup (Step 6)
✅ Deletes test invite  
✅ Deletes auth user  
✅ Deletes internal user  

## Expected Runtime

- **2-7 seconds** total
- No test data left behind after completion

## Getting the Auth Token

### Option 1: From Browser (Easiest)
1. Open your app: http://localhost:3000
2. Log in as super_admin
3. Open DevTools (F12)
4. Type: `document.cookie`
5. Find: `sb-dzrwxdjzgwvdmfbbfotn-auth-token=...`
6. Copy the long token value

### Option 2: Automated
```bash
# Create/provision users if needed
npm run provision:users
```

## Run Variations

```bash
# Option 1: Using npm script
export TEST_AUTH_TOKEN="token"
npm run test:invite-flow

# Option 2: Direct ts-node
export TEST_AUTH_TOKEN="token"
npx ts-node -r tsconfig-paths/register test-employee-invite-flow.ts

# Option 3: Using helper script
export TEST_AUTH_TOKEN="token"
node run-invite-test.js
```

## Check Test Results

```
✅ = Passed
❌ = Failed
⚠️  = Warning/partial success

Look at the final summary:
Total: 6 | Success: 6 | Failed: 0
```

## Full Documentation

See `EMPLOYEE_INVITE_TEST_README.md` for:
- Detailed setup instructions
- Troubleshooting guide
- API endpoint documentation
- Database tables used
- CI/CD integration
- How to extend tests

## Next Steps

1. **Run the test**: `export TEST_AUTH_TOKEN="..." && npm run test:invite-flow`
2. **Review output**: Check success/failure for each step
3. **Fix issues**: See troubleshooting section above
4. **Integrate**: Add to CI/CD pipeline (see full docs)

---

**Need help?** Check `EMPLOYEE_INVITE_TEST_README.md` for detailed guidance.
