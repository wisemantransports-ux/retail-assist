# PendingInvitesTable Component Setup Guide

## ✅ Installation Complete

### Dependencies Installed
- ✅ `react-hot-toast` - For toast notifications
- ✅ `lucide-react` - For icons (Copy, Check)

**Install Command:**
```bash
npm install react-hot-toast lucide-react
```

---

## 📋 Component Overview

**File Location:** `/app/components/PendingInvitesTable.tsx`

**Features:**
- ✅ Displays pending employee invites in a table
- ✅ Copy-to-clipboard functionality with invite link generation
- ✅ Toast notifications (success/error)
- ✅ Dynamic button state (Copy → Copied!)
- ✅ Auto-filters pending status invites
- ✅ TypeScript fully typed
- ✅ React 18+ with Client Component (`'use client'`)
- ✅ Next.js 16 compatible
- ✅ Responsive design with TailwindCSS

---

## 🎯 Table Columns

| Column | Description |
|--------|-------------|
| **Email** | Employee email address |
| **Status** | Current status (badge: yellow for "pending") |
| **Created At** | Date/time the invite was created (formatted) |
| **Action** | Copy Link button with dynamic state |

---

## 🚀 Usage Example

```tsx
import PendingInvitesTable from '@/components/PendingInvitesTable';

export default function DashboardPage() {
  const [employees, setEmployees] = useState([]);

  return (
    <div>
      <h2>Pending Invites</h2>
      <PendingInvitesTable 
        platformEmployees={employees}
        appBaseUrl="https://myapp.com"
        onInviteAction={(inviteId, action) => {
          console.log(`${action} for invite: ${inviteId}`);
        }}
      />
    </div>
  );
}
```

---

## 📦 Component Props

```typescript
interface PendingInvitesTableProps {
  // Required: Array of employee invites
  platformEmployees: EmployeeInvite[];
  
  // Optional: Base URL for invite links (defaults to window.location.origin)
  appBaseUrl?: string;
  
  // Optional: Callback when user performs actions
  onInviteAction?: (inviteId: string, action: 'copy' | 'revoke' | 'resend') => void;
}
```

---

## 🔗 Invite Link Format

When a user clicks "Copy Link", this format is copied to clipboard:

```
https://myapp.com/invite?token=<invite_id>
```

**Example:**
```
https://myapp.com/invite?token=123e4567-e89b-12d3-a456-426614174000
```

---

## 🎨 Button States

### Default State
- Icon: Copy icon (from lucide-react)
- Text: "Copy Link"
- Color: Blue (`bg-blue-100`, `text-blue-700`)
- Hover: Slightly darker blue

### After Click (Copied State)
- Icon: Check icon (from lucide-react)
- Text: "Copied!"
- Color: Green (`bg-green-100`, `text-green-700`)
- Duration: 2 seconds, then resets

---

## 🔔 Toast Notifications

**Success Toast:**
```
"Invite link copied!" (3 seconds, top-right)
```

**Error Toast:**
```
"Failed to copy link" (3 seconds, top-right)
```

---

## 📝 TypeScript Interfaces

```typescript
interface EmployeeInvite {
  id: string;                    // Unique invite ID (used as token)
  email: string;                 // Employee email
  status: string;                // Invite status ('pending', 'active', etc.)
  created_at?: string;           // ISO timestamp
  role?: string;                 // Employee role
  workspace_id?: string | null;  // Workspace reference
  invited_by?: string;           // User who created invite
  full_name?: string;            // Employee full name
  phone?: string;                // Employee phone
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
```

---

## 🛠️ Implementation Details

### Key Functions

**`generateInviteLink(inviteId: string)`**
- Generates the full invite URL
- Uses `appBaseUrl` prop
- Returns: `${appBaseUrl}/invite?token=${inviteId}`

**`handleCopyLink(invite: EmployeeInvite)`**
- Copies link to clipboard using `navigator.clipboard.writeText()`
- Shows success/error toast
- Updates button state to "Copied!"
- Auto-resets after 2 seconds
- Calls optional `onInviteAction` callback

**`pendingInvites` Filter**
- Automatically filters to show only `status === 'pending'` invites

### State Management

```typescript
const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
```

Tracks which invite's copy button was most recently clicked.

---

## ✨ Features in Detail

### Empty State
If no pending invites exist:
```
"No pending invites at the moment."
```

### Timestamp Formatting
Converts ISO timestamps to readable format:
```
"Jan 21, 2026, 02:30 PM"
```

### Debug Section
Collapsible `<details>` element shows:
- Invite link format template
- Example invite link
- Helpful for development/testing

### Accessibility
- Proper `<table>` semantics
- Button titles show full invite link on hover
- Disabled button state after copy
- Clear visual feedback

---

## 🧪 Testing Checklist

- [ ] Component renders without errors
- [ ] Pending invites display correctly
- [ ] Copy button works and copies correct link
- [ ] Success toast appears
- [ ] Button changes to "Copied!" state
- [ ] Button resets after 2 seconds
- [ ] Multiple invites can be copied in sequence
- [ ] Empty state displays when no pending invites

---

## 📚 Dependencies Version Info

```json
{
  "react-hot-toast": "^2.x.x",
  "lucide-react": "^0.x.x"
}
```

**Note:** Check `package.json` for exact installed versions.

---

## 🎯 Current Integration

**Location in Dashboard:** `/app/admin/platform-staff/page.tsx`

The component is already integrated in the Platform Staff Management page, displaying:
1. **Pending Invites section** - Shows pending invites with copy functionality
2. **Active Platform Staff section** - Shows confirmed employees

---

## 💡 Notes

- Component is fully client-side (`'use client'`)
- No backend API calls needed for copying
- Toast notifications require `Toaster` component (included)
- Uses TailwindCSS for styling
- Icons from lucide-react library
- Fully typed TypeScript implementation
- Next.js 16 compatible
- React 18+ hooks (`useState`, `useCallback`)

---

## 🐛 Troubleshooting

**"Module not found: Can't resolve '@/components/PendingInvitesTable'"**
- Ensure file is in `/app/components/PendingInvitesTable.tsx`
- Check `tsconfig.json` has `@/` path alias pointing to `./app`

**Toast notifications not showing**
- Ensure `react-hot-toast` is installed: `npm install react-hot-toast`
- Component includes `<Toaster />` component

**Icons not displaying**
- Ensure `lucide-react` is installed: `npm install lucide-react`
- Icons are imported correctly from lucide-react

**Copy to clipboard not working**
- Check browser console for errors
- Browser must support `navigator.clipboard` API
- Page must be served over HTTPS (or localhost)

---

Generated: January 21, 2026
