# Employee Invite Fix - January 22, 2026

## Issue Fixed
Employee invite acceptance was returning **"Database error during token lookup"** with error code `42703: column employee_invites.expires_at does not exist`

## Root Cause
The production database (`dzrwxdjzgwvdmfbbfotn.supabase.co`) had the `employee_invites` table but was missing the `expires_at` column because:
1. Migration 032 used `CREATE TABLE IF NOT EXISTS` 
2. The table already existed with different columns (`full_name`, `phone` added by other migrations)
3. The `CREATE TABLE IF NOT EXISTS` didn't execute, so `expires_at` was never added

## Solution Implemented

### Step 1: Fix /invite Route (Vercel 404 Issue)
**File:** [app/invite/layout.tsx](app/invite/layout.tsx)
- Created server-side layout with `export const dynamic = 'force-dynamic'`
- Removed `'use client'` directive from [app/invite/page.tsx](app/invite/page.tsx)
- This allows `useSearchParams()` to work on Vercel (not just localhost)

### Step 2: Fix Database Query (Column Missing Issue)
**File:** [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts)
- Removed `expires_at` from SELECT query (line 162)
- Calculate expiration using `created_at + 30 days` instead
- Updated expiration logic to compute 30-day window from `created_at`

### Step 3: Create Migration for Future Use
**File:** [supabase/migrations/036_add_expires_at_to_invites.sql](supabase/migrations/036_add_expires_at_to_invites.sql)
- Migration adds `expires_at` column to production database
- Creates necessary indexes
- Updates existing rows with default expiration dates
- Can be applied manually via Supabase dashboard SQL editor

## How to Apply Missing Migration (Optional)

If you want to add the `expires_at` column to match the code intent, run these SQL commands in Supabase dashboard SQL editor:

```sql
-- Add missing expires_at column
ALTER TABLE public.employee_invites 
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');

-- Create index for expiration queries
CREATE INDEX IF NOT EXISTS idx_employee_invites_expires_at ON public.employee_invites(expires_at);

-- Update existing rows
UPDATE public.employee_invites 
SET expires_at = created_at + interval '30 days' 
WHERE expires_at IS NULL;
```

## Status
✅ Employee invite acceptance now works on Vercel  
✅ 30-day expiration enforced (calculated from `created_at`)  
✅ Build passes with zero TypeScript errors  
✅ Code is backward compatible (works without `expires_at` column)

## Testing
Test the invite flow with: `https://your-vercel-url.vercel.app/invite?token=YOUR_TOKEN_HERE`

Expected flow:
1. ✓ Invite page loads (no 404)
2. ✓ Form displays with email, first name, last name, password fields  
3. ✓ Submit creates auth account and employee record
4. ✓ Redirects to employee dashboard
5. ✓ Employee can log in with new credentials
