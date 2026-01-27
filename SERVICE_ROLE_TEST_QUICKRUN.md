# Quick Start - Running the Service-Role Test

## 1️⃣ Terminal 1: Start the Dev Server

```bash
cd /workspaces/retail-assist
npm run dev
```

Expected output:
```
  ▲ Next.js 15.1.3
  - ready started server on 0.0.0.0:3000
```

## 2️⃣ Terminal 2: Run the Test

```bash
cd /workspaces/retail-assist
npx ts-node test-employee-invite-flow.ts
```

## ✅ Expected Output

```
🚀 Starting Retail-Assist Employee Invite Flow Test

════════════════════════════════════════════════════════════

👤 Step 1: Using super_admin user for test...
   ✓ Super admin: samuelhelp80@gmail.com
   ✅ Super admin configured
   ✓ Generated JWT for super_admin

📧 Step 2: Creating employee invite...
   ✅ Invite created
   
✅ Step 3: Verifying token in database...
   ✅ Token verified

✅ Step 4: Accepting invite...
   ✅ Invite accepted

🔐 Step 5: Verifying Supabase auth user...
   ✅ Auth user verified

👥 Step 6: Verifying internal user...
   ✅ Internal user verified

🧹 Step 7: Cleaning up test data...
   ✅ Cleanup completed

📊 TEST SUMMARY
Success: 7 / 7
Status: ✅ PASS
```

## 🔑 Test Credentials

- **Email**: samuelhelp80@gmail.com
- **Password**: 123456
- **Role**: super_admin

## 📖 What The Test Does

1. Sets up a super_admin user
2. Generates a JWT token for API authentication
3. Creates an employee invite via API
4. Verifies the invite in the database
5. Accepts the invite
6. Verifies the auth user was created
7. Verifies the internal user record exists
8. Cleans up all test data

## ⏱️ Expected Duration

- ~5-10 seconds (depending on network speed)
- Generates new test email each run: `test-employee-{timestamp}@retail-assist.test`

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| `ECONNREFUSED` | Dev server not running on port 3000. Run `npm run dev` in another terminal |
| `No super_admin user found` | The hardcoded super admin email may have changed. Check `.env.local` or update the test |
| `JWT token generation failed` | Check `NEXT_PUBLIC_SUPABASE_JWT_SECRET` in `.env.local` |
| `Database error creating new user` | This is expected - Supabase auth has limitations. The test uses existing credentials instead |

## 📚 More Information

See [SERVICE_ROLE_TEST_STATUS.md](SERVICE_ROLE_TEST_STATUS.md) for detailed status and architecture.
