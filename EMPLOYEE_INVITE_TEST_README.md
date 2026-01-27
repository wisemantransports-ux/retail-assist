# Employee Invite Flow Test Script

This comprehensive test script validates the complete Retail-Assist employee invite flow, from invitation creation through user account setup and cleanup.

## Overview

The test script performs the following steps:

1. **Generate Random Email** - Creates a unique test email address
2. **Create Invite** - Calls `/api/platform-employees` to generate an invite
3. **Verify Token in Database** - Confirms the token matches what's stored in the database
4. **Accept Invite** - Calls `/api/employees/accept-invite` to complete the signup
5. **Verify Auth User** - Confirms user was created in Supabase `auth.users`
6. **Verify Internal User** - Confirms user was created in the internal `users` table
7. **Cleanup** - Removes all test data from the database

## Files

- **`test-employee-invite-flow.ts`** - Main TypeScript test script with all validation logic
- **`run-invite-test.js`** - Helper script to execute the TypeScript test

## Prerequisites

### 1. Running Application

The application must be running locally:

```bash
npm run dev
```

This starts the Next.js server on `localhost:3000`.

### 2. Authentication Token

You need a valid authentication token from a **super_admin** user. There are two ways to obtain this:

#### Option A: Extract from Browser Cookies (Easiest)

1. Start the application (`npm run dev`)
2. Log in as a super_admin user in your browser
3. Open the browser console and run:
   ```javascript
   document.cookie
   ```
4. Look for `sb-dzrwxdjzgwvdmfbbfotn-auth-token=...`
5. Copy the token value and set it as an environment variable:
   ```bash
   export TEST_AUTH_TOKEN="your_token_here"
   ```

#### Option B: Use the Existing Super Admin

If you already have a super admin account created in the database, you can use its credentials to log in and obtain a token.

#### Option C: Create a Super Admin User

If no super admin exists, run:

```bash
npm run provision:users
```

This creates the necessary admin users.

### 3. Supabase Connection

Ensure your `.env.local` file has valid Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Running the Test

### Method 1: Using npm script

Add this to `package.json` scripts:

```json
{
  "scripts": {
    "test:invite-flow": "TEST_AUTH_TOKEN=\"$TEST_AUTH_TOKEN\" npx ts-node -r tsconfig-paths/register test-employee-invite-flow.ts"
  }
}
```

Then run:

```bash
export TEST_AUTH_TOKEN="your_token_here"
npm run test:invite-flow
```

### Method 2: Direct execution

```bash
export TEST_AUTH_TOKEN="your_token_here"
npx ts-node -r tsconfig-paths/register test-employee-invite-flow.ts
```

### Method 3: Using the helper script

```bash
export TEST_AUTH_TOKEN="your_token_here"
node run-invite-test.js
```

## Expected Output

A successful test run shows:

```
🚀 Starting Retail-Assist Employee Invite Flow Test

============================================================

🔑 Obtaining authentication token...
   ✅ Token obtained

📧 Step 1: Creating employee invite...
   Email: test-employee-1234567890-abc123@retail-assist.test
   ✅ Invite created
   ✓ Invite ID: 550e8400-e29b-41d4-a716-446655440000
   ✓ Token: 123e4567-e89b-12d3...

🔍 Step 2: Verifying token in database...
   ✓ Invite found in database
   ✓ Token: 123e4567-e89b-12d3...
   ✓ Status: pending
   ✓ Email: test-employee-1234567890-abc123@retail-assist.test
   ✅ Token matches!

✅ Step 3: Accepting invite...
   Token: 123e4567-e89b-12d3...
   ✅ Invite accepted
   ✓ User ID: 4f4a2d8e-8b9c-4e5d-a1b2-c3d4e5f6g7h8
   ✓ Role: employee
   ✓ Workspace ID: platform-level

🔐 Step 4: Verifying Supabase auth user...
   Email: test-employee-1234567890-abc123@retail-assist.test
   ✅ User found in auth.users
   ✓ Auth UID: auth_1234567890
   ✓ Email: test-employee-1234567890-abc123@retail-assist.test
   ✓ Email Verified: Yes

📋 Step 5: Verifying internal user...
   Auth UID: auth_1234567890
   Email: test-employee-1234567890-abc123@retail-assist.test
   ✅ User found in internal users table
   ✓ User ID: 4f4a2d8e-8b9c-4e5d-a1b2-c3d4e5f6g7h8
   ✓ Auth UID: auth_1234567890
   ✓ Email: test-employee-1234567890-abc123@retail-assist.test
   ✓ Role: employee
   ✓ Workspace ID: null (platform-level)

🧹 Step 6: Cleaning up test data...
   • Deleting invites...
     ✓ Invites deleted
   • Deleting internal user...
     ✓ Internal user deleted
   • Deleting auth user...
     ✓ Auth user deleted
   ✅ Cleanup completed

============================================================

📊 TEST SUMMARY

✅ Create Invite: Invite created successfully
✅ Verify Token in Database: Token verified in database
✅ Accept Invite: Invite accepted successfully
✅ Verify Auth User: User verified in auth.users
✅ Verify Internal User: User verified in internal users table
✅ Cleanup: Test data cleaned up successfully

────────────────────────────────────────────────────────────
Total: 6 | Success: 6 | Failed: 0

🎉 All tests passed!
```

## Troubleshooting

### Error: "TEST_AUTH_TOKEN environment variable not set"

**Solution:** Set the token before running:
```bash
export TEST_AUTH_TOKEN="your_token_here"
```

### Error: "HTTP 401: Unauthorized"

**Solution:** The token is invalid or expired. Get a fresh token:
1. Log in to the application again as super_admin
2. Extract the new token from browser cookies
3. Update the environment variable

### Error: "HTTP 403: Super admins only"

**Solution:** The token belongs to a non-admin user. Use a super_admin token.

### Error: "Failed to connect to localhost:3000"

**Solution:** The application is not running. Start it:
```bash
npm run dev
```

### Error: "Database error: permission denied"

**Solution:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is correct in `.env.local`.

### Error: "Token mismatch"

**Solution:** There's a bug in the invite creation endpoint. Check:
1. Token is being generated correctly
2. Token is being stored in database
3. Token is being returned in response

## What the Test Validates

### Invite Creation
- ✅ Email validation
- ✅ Token generation (random UUID)
- ✅ Token storage in database
- ✅ Invite record creation with correct status
- ✅ Response contains correct token

### Invite Acceptance
- ✅ Token lookup in database
- ✅ User account creation in Supabase Auth
- ✅ Internal user record creation
- ✅ Invite status update to "accepted"
- ✅ User role assignment

### Data Verification
- ✅ Auth user has correct email
- ✅ Internal user has correct auth_uid
- ✅ Email verification in auth.users
- ✅ User active status in internal table

### Cleanup
- ✅ Invite deletion
- ✅ Auth user deletion
- ✅ Internal user deletion
- ✅ No orphaned records

## Performance Expectations

A complete test run typically takes:
- **2-5 seconds** for all HTTP requests
- **1-2 seconds** for database operations
- **Total: 3-7 seconds**

## Extending the Test

To add additional validations, modify `test-employee-invite-flow.ts`:

```typescript
// Add a new step function
async function validateCustomField(userId: string): Promise<TestResult> {
  try {
    console.log('\n🔍 Step X: Checking custom field...');
    // Your validation logic
    return {
      step: 'Custom Validation',
      status: 'success',
      message: 'Validation passed',
    };
  } catch (error) {
    return {
      step: 'Custom Validation',
      status: 'failed',
      message: String(error),
    };
  }
}

// Add to runTests() after acceptInvite
const customResult = await validateCustomField(internalUserId);
results.push(customResult);
```

## Continuous Integration

To integrate into CI/CD (GitHub Actions):

```yaml
- name: Test Employee Invite Flow
  env:
    TEST_AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
  run: |
    npm run dev &
    sleep 5  # Wait for server to start
    npm run test:invite-flow
```

Store the super_admin token in GitHub Secrets as `TEST_AUTH_TOKEN`.

## API Endpoints Tested

### 1. POST /api/platform-employees
Creates a new employee invite at the platform level.

**Request:**
```javascript
{
  email: "test@example.com",
  role: "employee"  // optional
}
```

**Response:**
```javascript
{
  success: true,
  message: "Invite created successfully",
  invite: {
    id: "uuid",
    token: "uuid",
    email: "test@example.com"
  }
}
```

### 2. POST /api/employees/accept-invite?token=...
Accepts an invite and creates the user account.

**Request:**
```javascript
{
  email: "test@example.com",
  first_name: "Test",
  last_name: "Employee",
  password: "SecurePassword123!"
}
```

**Response:**
```javascript
{
  success: true,
  user_id: "uuid",
  workspace_id: null,
  role: "employee",
  message: "Invite accepted successfully"
}
```

## Database Tables Used

- **`employee_invites`** - Stores pending invitations
- **`users`** - Internal user records
- **`auth.users`** - Supabase authentication users

## Support

For issues or questions, check:
1. The application logs: `npm run dev` output
2. Supabase Dashboard: https://app.supabase.com
3. Browser DevTools: Network tab for failed requests
4. Script error output: Review the error messages above

---

**Last Updated:** January 24, 2026  
**Maintainer:** Retail-Assist Development Team
