# Service-Role Authentication Test Guide

## Overview

The `test-employee-invite-flow.ts` test file has been completely refactored to use **service-role authentication** instead of relying on TEST_AUTH_TOKEN or manual password-based login.

### Key Benefits

✅ **No browser required** - Fully automated CLI test  
✅ **No password or sensitive login stored** - Uses JWT signed in-memory  
✅ **No environment tokens needed** - Uses SUPABASE_SERVICE_ROLE_KEY  
✅ **Fully automated** - Can be run in CI/CD pipelines  
✅ **Repeatable** - Creates and cleans up test data automatically  
✅ **Safe** - No secrets logged, JWT cleared from memory  

---

## Prerequisites

Ensure you have the following environment variables set in `.env.local`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_JWT_SECRET=your-jwt-secret
```

**Important:** The `SUPABASE_SERVICE_ROLE_KEY` must have full permissions to create/delete users, as it uses the admin API.

---

## How It Works

### 1. Service-Role Client Initialization

```typescript
function createAdminSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Creates admin client with full privileges
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

**Why:** The service-role key allows bypassing normal auth rules and provides full database access.

### 2. Temporary Super Admin Creation

```typescript
async function createTemporarySuperAdmin()
  // Uses service-role client to create auth user
  → admin.auth.admin.createUser({...})
  
  // Creates corresponding internal user record
  → admin.from('users').insert({
      role: 'super_admin',
      ...
    })
```

**What happens:**
- Creates a temporary auth user with a random email
- Creates an internal user record with super_admin role
- Returns auth ID and internal ID for cleanup later

### 3. JWT Generation (In-Memory Only)

```typescript
function generateTestJWT(userId: string, email: string): string {
  const secret = process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET;
  
  const payload = {
    iss: 'https://supabase.co',
    sub: userId,
    aud: 'authenticated',
    email: email,
    email_verified: true,
    // ... other claims
  };
  
  // Sign without logging or storing
  const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
  
  // Note: This JWT is NOT stored - only used in HTTP requests
  return token;
}
```

**Why in-memory only:**
- JWT is generated fresh for each test
- Never logged to console (except length for verification)
- Explicitly cleared from memory after cleanup: `superAdminJWT = null`
- No persistence to disk or environment variables

### 4. Test Flow

```
Step 1: Create Temporary Super Admin
  ├─ Admin user created (auth + internal)
  └─ JWT generated for super_admin

Step 2: Create Employee Invite
  ├─ Use super_admin JWT in Authorization header
  └─ API creates employee_invites record

Step 3: Verify Token in Database
  ├─ Query employee_invites table
  └─ Confirm token matches

Step 4: Accept Invite
  ├─ Generate new JWT for employee
  └─ POST to accept-invite with JWT

Step 5: Verify Auth User
  ├─ Query auth.users table
  └─ Confirm user exists

Step 6: Verify Internal User
  ├─ Query users table
  └─ Confirm role and workspace_id

Step 7: Cleanup
  ├─ Delete employee_invites
  ├─ Delete employee's internal user
  ├─ Delete employee's auth user
  ├─ Delete super_admin's internal user
  └─ Delete super_admin's auth user
```

---

## Running the Test

### Prerequisites

1. Start the dev server:
```bash
npm run dev
```

2. Ensure environment variables are set in `.env.local`:
```bash
SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key
NEXT_PUBLIC_SUPABASE_JWT_SECRET=your-secret
```

### Execute Test

```bash
# Using npx with ts-node (recommended)
npx ts-node test-employee-invite-flow.ts

# Or using tsx
npx tsx test-employee-invite-flow.ts

# Or if compiled to JavaScript
node test-employee-invite-flow.js
```

### Expected Output

```
🚀 Starting Retail-Assist Employee Invite Flow Test

═════════════════════════════════════════════════════════

👤 Step 1: Creating temporary super_admin user...
   ✓ Auth user created: 550e8400-e29b-41d4-a716-446655440000
   ✓ Internal user created: c9e9d8f6-7a1e-4a2b-9c3f-5d6e7f8a9b0c
   ✅ Super admin created successfully
   ✓ Generated JWT for super_admin (length: 347)

📧 Step 2: Creating employee invite...
   Email: test-employee-1737849012345-a1b2c3@retail-assist.test
   ✅ Invite created
   ✓ Invite ID: invite-uuid-here
   ✓ Token: eyJhbGciOiJIUzI1NiI...

🔍 Step 3: Verifying token in database...
   ✓ Invite found in database
   ✓ Token: eyJhbGciOiJIUzI1NiI...
   ✓ Status: pending
   ✓ Email: test-employee-1737849012345-a1b2c3@retail-assist.test
   ✅ Token matches!

📝 Generated JWT for employee (length: 319)

✅ Step 4: Accepting invite...
   Token: eyJhbGciOiJIUzI1NiI...
   Email: test-employee-1737849012345-a1b2c3@retail-assist.test
   ✅ Invite accepted
   ✓ User ID: user-uuid-here
   ✓ Role: employee
   ✓ Workspace ID: platform-level

🔐 Step 5: Verifying Supabase auth user...
   Email: test-employee-1737849012345-a1b2c3@retail-assist.test
   ✅ User found in auth.users
   ✓ Auth UID: 12345678-1234-5678-1234-567812345678
   ✓ Email: test-employee-1737849012345-a1b2c3@retail-assist.test
   ✓ Email Verified: Yes

📋 Step 6: Verifying internal user...
   Auth UID: 12345678-1234-5678-1234-567812345678
   Email: test-employee-1737849012345-a1b2c3@retail-assist.test
   ✅ User found in internal users table
   ✓ User ID: c9e9d8f6-7a1e-4a2b-9c3f-5d6e7f8a9b0c
   ✓ Auth UID: 12345678-1234-5678-1234-567812345678
   ✓ Email: test-employee-1737849012345-a1b2c3@retail-assist.test
   ✓ Role: employee
   ✓ Workspace ID: null (platform-level)

🧹 Step 7: Cleaning up test data...
   • Deleting invites...
     ✓ Invites deleted
   • Deleting internal user...
     ✓ Internal user deleted
   • Deleting auth user...
     ✓ Auth user deleted
   • Deleting temporary super_admin internal user...
     ✓ Super admin internal user deleted
   • Deleting temporary super_admin auth user...
     ✓ Super admin auth user deleted
   ✅ Cleanup completed

═════════════════════════════════════════════════════════

📊 TEST SUMMARY

┌─────────────────────────────────────┬─────────┐
│ Step                                │ Status  │
├─────────────────────────────────────┼─────────┤
│ Create Temporary Super Admin        │ ✅ PASS │
│ Create Invite                       │ ✅ PASS │
│ Verify Token in Database            │ ✅ PASS │
│ Accept Invite                       │ ✅ PASS │
│ Verify Auth User                    │ ✅ PASS │
│ Verify Internal User                │ ✅ PASS │
│ Cleanup                             │ ✅ PASS │
└─────────────────────────────────────┴─────────┘

Success: 7 / 7
Failures: 0
Status: ✅ PASS

🎉 All tests passed!
```

---

## Security Considerations

### What's Protected

✅ **Service-role key** - Only in environment variables (never logged)  
✅ **JWT tokens** - Generated in-memory, never logged (length shown for verification)  
✅ **Passwords** - No passwords used anywhere  
✅ **Test data** - Automatically cleaned up after test completes  

### What's NOT Secret

❌ Test email addresses - Generated with timestamps for uniqueness  
❌ User IDs - Generated by system  
❌ Step logs - Shows process but not credentials  

---

## Troubleshooting

### Error: "Missing required environment variables"

```
Error: Missing required environment variables:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
```

**Fix:** Add these to your `.env.local`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error: "Failed to create auth user"

```
Error: Failed to create auth user: <error message>
```

**Possible causes:**
- Service-role key is invalid or expired
- Supabase project is not running
- Database constraints violated

**Fix:**
1. Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
2. Check that Supabase project is active
3. Run `npm run dev` to ensure the app is running

### Error: "Failed to create invite"

```
Error: HTTP 500 or 401
```

**Possible causes:**
- JWT is invalid
- App is not running on localhost:3000
- Missing super_admin privileges

**Fix:**
1. Check that dev server is running: `npm run dev`
2. Verify the app is listening on port 3000
3. Check super_admin user was created successfully (look for "Super admin created successfully" log)

### Error: "Cleanup failed"

```
⚠️  Some cleanup steps failed:
  - Super admin user deletion: <error>
```

**Possible causes:**
- Test data already partially deleted
- Database connection lost during cleanup

**Fix:**
1. Check Supabase status
2. Can manually cleanup with SQL:
   ```sql
   DELETE FROM auth.users WHERE email LIKE 'temp-super-admin-%@retail-assist.test';
   DELETE FROM auth.users WHERE email LIKE 'test-employee-%@retail-assist.test';
   DELETE FROM public.users WHERE email LIKE 'temp-super-admin-%@retail-assist.test';
   DELETE FROM public.users WHERE email LIKE 'test-employee-%@retail-assist.test';
   DELETE FROM public.employee_invites WHERE email LIKE 'test-employee-%@retail-assist.test';
   ```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test Employee Invite Flow

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start dev server
        run: npm run dev &
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          NEXT_PUBLIC_SUPABASE_JWT_SECRET: ${{ secrets.NEXT_PUBLIC_SUPABASE_JWT_SECRET }}
      
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run invite flow test
        run: npx tsx test-employee-invite-flow.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          NEXT_PUBLIC_SUPABASE_JWT_SECRET: ${{ secrets.NEXT_PUBLIC_SUPABASE_JWT_SECRET }}
```

---

## Code Changes Summary

### What Changed

| Aspect | Before | After |
|--------|--------|-------|
| **Auth Method** | TEST_AUTH_TOKEN env var | Service-role + JWT |
| **User Creation** | Manual login required | Programmatic via admin API |
| **JWT Handling** | External token | Generated in-memory |
| **Password** | Required (TestPassword123!) | Not used |
| **Cleanup** | Manual | Automatic |
| **Security** | Env token exposed | No tokens in env |

### New Functions

```typescript
function createAdminSupabaseClient()      // Admin client with service-role
function generateTestJWT()                 // In-memory JWT generation
async function createTemporarySuperAdmin() // Programmatic admin user
```

### Removed

```typescript
async function getAuthToken()  // No longer needed - JWT is generated
```

### Modified Steps

- **Step 1:** Now creates super_admin (was implicit, required env var)
- **Step 2-3:** Use generated JWT (was manual AUTH_TOKEN)
- **Step 4:** Accept with generated employee JWT (was password)
- **Step 7:** Cleanup includes super_admin deletion (was n/a)

---

## Testing the Test

To verify the test file itself works correctly:

```bash
# Syntax check
npx tsc --noEmit test-employee-invite-flow.ts

# Run with debug output
DEBUG=* npx tsx test-employee-invite-flow.ts

# Run with timeout
timeout 60s npx tsx test-employee-invite-flow.ts
```

---

## FAQ

**Q: Why generate JWT in-memory instead of using a token?**  
A: Avoids storing sensitive tokens in environment or logs. JWT is only in memory for the duration of the HTTP request.

**Q: What if Supabase service-role key is compromised?**  
A: The test only uses it to create temporary users for testing. Rotate the key in Supabase dashboard immediately.

**Q: Can this be run in parallel?**  
A: Yes, each test run generates unique email addresses with timestamps, so multiple runs won't conflict.

**Q: Does this test production data?**  
A: No, it creates and deletes test users with unique email addresses. No real production data is affected.

**Q: Can I use this for manual testing?**  
A: Yes, run `npx tsx test-employee-invite-flow.ts` whenever you need to test the invite flow without a browser.

---

## Version History

- **v2.0.0** (2026-01-25): Service-role authentication with JWT
  - Removed TEST_AUTH_TOKEN dependency
  - Added automatic super_admin creation
  - In-memory JWT generation
  - Comprehensive cleanup

- **v1.0.0** (2026-01-20): Original TOKEN-based implementation
  - Required TEST_AUTH_TOKEN env var
  - Manual password entry
  - Basic cleanup
