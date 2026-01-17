# Vercel Login Error - Root Cause & Fix

## What Was Happening
The error `Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.` occurs at **runtime** when the login endpoint tries to authenticate a user.

The code was correctly updated to read environment variables at runtime (not build time), but **Vercel was not set up with these environment variables**.

## The Solution

You must configure environment variables in Vercel before the app can run:

### Step 1: Get Supabase Credentials
1. Log into [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings → API**
4. Copy these values:
   - **Project URL** (top of page)
   - **Service Role Secret** (under "Project API keys")
   - **Anon Public** (under "Project API keys")

### Step 2: Set Variables in Vercel
1. Go to [Vercel Dashboard](https://vercel.com) → Your Project
2. Click **Settings → Environment Variables**
3. Make sure you're in the **Production** environment
4. Add these variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `SUPABASE_URL` | Your Project URL | Secret - hidden in logs |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Secret | **SECRET** - hidden in logs |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Project URL | Public, visible in client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon Public Key | Public, visible in client |
| `NEXT_PUBLIC_USE_MOCK_SUPABASE` | `false` | Disable mock mode for production |

### Step 3: Redeploy
```bash
git push
# OR click "Redeploy" in Vercel dashboard
```

### Step 4: Verify
Once deployment completes:
1. Visit `https://your-app.vercel.app/api/debug/env` to see which env vars are loaded
2. Try logging in - should work now

## Code Changes Made

✅ Enhanced error messages with diagnostic info  
✅ Added debug endpoint to check environment at runtime  
✅ Updated VERCEL_SETUP.md with complete setup guide  

## If Login Still Fails

1. **Check the debug endpoint**: `https://your-app.vercel.app/api/debug/env`
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` show as `SET`

2. **Verify in Vercel logs**:
   - Go to Vercel Dashboard → Deployments → Latest → Logs
   - Search for `[Supabase Config Error]` to see diagnostic info

3. **Common issues**:
   - Variables set in wrong environment (must be Production for main branch)
   - Typos in variable names
   - Missing redeploy after adding variables
   - Service role key is wrong (must be the SECRET, not the public key)

## Next Steps

1. Add the environment variables to Vercel ✅
2. Redeploy your app ✅
3. Test login endpoint ✅
4. Verify all user roles work (super_admin, client_admin, employee) ✅
