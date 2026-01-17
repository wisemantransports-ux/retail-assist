# Vercel Deployment - Environment Variables Setup

## Critical Issue
The login endpoints are failing because Supabase environment variables are not being detected at runtime on Vercel.

## Required Environment Variables

On Vercel, you **MUST** set these variables in your project settings:

### Server-Side Only (NO NEXT_PUBLIC_ prefix)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (SECRET - keep hidden)

### Client-Side (Can use NEXT_PUBLIC_ prefix)
- `NEXT_PUBLIC_SUPABASE_URL` - Same as SUPABASE_URL (exposed to client)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key (safe to expose)

### Optional
- `NEXT_PUBLIC_USE_MOCK_SUPABASE` - Set to `false` for production

## Setup Steps for Vercel

1. Go to **Vercel Project Settings → Environment Variables**

2. Add these variables (for Production environment):

   ```
   SUPABASE_URL = https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY = eyJ... (your service role key)
   NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ... (your anon key)
   NEXT_PUBLIC_USE_MOCK_SUPABASE = false
   ```

3. Make sure to use the **correct environment** (Production)

4. **Redeploy** after setting variables:
   ```bash
   git push
   # or click "Redeploy" in Vercel dashboard
   ```

## How to Get Your Credentials

1. Log into [Supabase](https://app.supabase.com)
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → Use as `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - **Service Role Secret** → Use as `SUPABASE_SERVICE_ROLE_KEY`
   - **Anon Public** → Use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Debugging

If login still fails after setting variables:

1. Check the debug endpoint: `https://your-vercel-app.vercel.app/api/debug/env`
   - This will show which env vars are available at runtime

2. Verify in Vercel logs:
   - Go to Vercel dashboard → Your project → Deployments
   - Click on latest deployment → Logs
   - Look for "[Supabase Config Debug]" messages

3. Common issues:
   - Environment variables not persisted (check that checkboxes are checked in Vercel UI)
   - Wrong environment selected (must be "Production" for main branch)
   - Need to redeploy after changing variables
   - Copy-paste errors in secret keys

## Code Changes Made

The application has been updated to read Supabase credentials **at runtime** (when handlers execute), not at build time. This is why environment variables must be set in Vercel:

- `app/lib/supabase/server.ts` - All env vars read inside functions via `getEnv()`
- `app/lib/supabaseAdmin.ts` - Lazy factory function `getSupabaseAdmin()`
- `app/lib/env.ts` - Lazy getters for all env properties

This approach allows the build to complete without credentials, but requires them to be present when the application runs.

## After Deployment

Once environment variables are set and deployment is redeployed:

1. Test login: `POST /api/auth/login`
2. Test signup: `POST /api/auth/signup`
3. Test RPC calls: Check role-based access via `/api/auth/me`
4. Verify all user roles work: super_admin, client_admin, employee

## Important Notes

- **Never commit `.env` files** - always use Vercel Environment Variables
- **SERVICE_ROLE_KEY is a secret** - Vercel will mask it in logs
- Env variables are loaded when Vercel starts your application
- Changes take effect on next deployment
