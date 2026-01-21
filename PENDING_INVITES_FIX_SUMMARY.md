# Fix: Pending Invite Copy Button Not Showing

## Problem
Pending invites were showing on the dashboard, but the Copy Link button was missing.

## Root Cause
The platform-staff page was fetching from the `employees` table (via `/api/platform-employees`) and filtering for `status === 'pending'`. However, newly created invites are stored in the `employee_invites` table, not the `employees` table. The `employees` table only has records for confirmed/active employees.

## Solution Implemented

### 1. Created New Hook: `usePendingInvites`
**File:** `/app/hooks/usePendingInvites.ts`

- Fetches pending invites from `/api/platform-employees/invites`
- Manages pending invites state separately from employees state
- Includes methods to revoke and resend invites

### 2. Created New API Endpoint
**File:** `/app/api/platform-employees/invites/route.ts`

- GET endpoint to fetch all pending employee invites
- Queries `employee_invites` table with `status = 'pending'`
- Filters for platform staff: `workspace_id = null`
- Super admin authorization required

### 3. Updated Platform Staff Page
**File:** `/app/admin/platform-staff/page.tsx`

Changes:
- ✅ Import new `usePendingInvites` hook
- ✅ Initialize hook alongside `usePlatformEmployees`
- ✅ Fetch pending invites on page load (in useEffect)
- ✅ Refresh pending invites after creating a new invite
- ✅ Pass `pendingInvites` to `PendingInvitesTable` component
- ✅ Add error display for invite fetch errors

## How It Works Now

1. **Page Loads**
   - Fetches active employees from `employees` table → shown in "Active Platform Staff"
   - Fetches pending invites from `employee_invites` table → shown in "Pending Invites"

2. **Create New Invite**
   - POST to `/api/platform-employees`
   - RPC inserts into `employee_invites` table with `status = 'pending'`
   - Page refreshes both employees AND pending invites

3. **Pending Invites Section**
   - Displays all pending invites with Email, Status, Created At columns
   - **Copy Link button** → Copies `https://myapp.com/invite?token=<invite_id>`
   - Shows green "Copied!" feedback for 2 seconds
   - Toast notification: "Invite link copied!"

## Data Flow

```
Create Invite
    ↓
POST /api/platform-employees
    ↓
RPC inserts into employee_invites table
    ↓
Status: 'pending'
    ↓
Page refreshes invites via fetchPendingInvites()
    ↓
GET /api/platform-employees/invites
    ↓
Returns from employee_invites table
    ↓
PendingInvitesTable displays with Copy button
```

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `/app/hooks/usePendingInvites.ts` | Created | Hook to manage pending invites |
| `/app/api/platform-employees/invites/route.ts` | Created | API to fetch pending invites |
| `/app/admin/platform-staff/page.tsx` | Modified | Updated to use pending invites hook |

## Testing Checklist

- [ ] Create a new employee invite
- [ ] Verify invite appears in "Pending Invites" section
- [ ] Click "Copy Link" button
- [ ] Verify toast shows "Invite link copied!"
- [ ] Check button changes to "Copied!" for 2 seconds
- [ ] Paste link and verify format: `https://myapp.com/invite?token=<id>`
- [ ] Create multiple invites and copy different links
- [ ] Refresh page and verify pending invites persist

## Next Steps (Optional)

If you want to add more functionality:

1. **Revoke Invite** - Add DELETE endpoint at `/api/platform-employees/invites/[id]`
2. **Resend Invite** - Add POST endpoint at `/api/platform-employees/invites/[id]/resend`
3. **Invite Email** - Send email with invite link when created
4. **Accept Invite Page** - Create `/invite` page to accept pending invites

---

**Status:** ✅ READY TO TEST

Try creating an invite now. You should see it appear in the "Pending Invites" section with a working Copy Link button!
