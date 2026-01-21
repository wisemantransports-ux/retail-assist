# ClientEmployeeInvite - Quick Reference

## Component File Location
`/app/components/ClientEmployeeInvite.tsx`

## Updated Props Interface

```typescript
interface ClientEmployeeInviteProps {
  workspaceId: string;      // Workspace UUID
  adminId: string;          // Admin user ID
  isSuperAdmin?: boolean;   // Optional: true for super admin mode
  defaultRole?: string;     // Optional: default role for super admin invites
}
```

## Updated Component Declaration

```typescript
export const ClientEmployeeInvite: React.FC<ClientEmployeeInviteProps> = ({
  workspaceId,
  adminId,
  isSuperAdmin = false,
  defaultRole = 'employee',
}) => {
  // Component logic...
};
```

## Key Function: Smart RPC Parameter Builder

```typescript
const handleSubmitInvite = useCallback(
  async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate email...
    if (!email.trim()) {
      setError('Email is required');
      toast.error('Please enter an email address');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Invalid email format');
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      // ⭐ KEY CHANGE: Build RPC parameters based on admin type
      const rpcParams: Record<string, any> = {
        p_email: email.trim().toLowerCase(),
        p_invited_by: adminId,
      };

      // Only add extra fields for super admin
      if (isSuperAdmin) {
        rpcParams.p_role = defaultRole;
        rpcParams.p_workspace_id = workspaceId || null;
      }

      console.log('[ClientEmployeeInvite] Calling RPC with params:', {
        ...rpcParams,
        p_invited_by: '***HIDDEN***',
      });

      // Call RPC with dynamic parameters
      const { data, error: rpcError } = await supabase.rpc(
        'rpc_create_employee_invite',
        rpcParams
      );

      if (rpcError) {
        console.error('[ClientEmployeeInvite] RPC error:', rpcError);
        const errorMsg =
          rpcError.message ||
          (typeof rpcError === 'object' ? JSON.stringify(rpcError) : String(rpcError));
        setError(errorMsg);
        toast.error(`Failed to create invite: ${errorMsg}`);
        return;
      }

      // Success: add new invite to list
      if (data && data.length > 0) {
        const newInvite: ClientEmployeeInvite = {
          id: data[0].id,
          email: data[0].email,
          status: data[0].status,
          created_at: data[0].created_at,
          role: data[0].role,
          workspace_id: data[0].workspace_id,
          invited_by: data[0].invited_by,
          full_name: data[0].full_name,
          phone: data[0].phone,
          metadata: data[0].metadata,
        };

        setInvites((prev) => [newInvite, ...prev]);
        toast.success(`Invite sent to ${email}!`);
        console.log('[ClientEmployeeInvite] Invite created successfully:', newInvite.id);

        // Clear input field
        setEmail('');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[ClientEmployeeInvite] Unexpected error:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  },
  [email, adminId, isSuperAdmin, defaultRole]
);
```

## Copy Link Function (Already Implemented)

```typescript
const handleCopyLink = useCallback(async (invite: ClientEmployeeInvite) => {
  const inviteLink = generateInviteLink(invite.id);

  try {
    await navigator.clipboard.writeText(inviteLink);
    toast.success('Link copied to clipboard!', { duration: 2000 });
    setCopiedInviteId(invite.id);

    setTimeout(() => {
      setCopiedInviteId(null);
    }, 2000);
  } catch (err) {
    console.error('[ClientEmployeeInvite] Copy error:', err);
    toast.error('Failed to copy link');
  }
}, [generateInviteLink]);
```

## Usage Patterns

### Pattern 1: Client Admin Invite
```typescript
<ClientEmployeeInvite 
  workspaceId={currentWorkspaceId}
  adminId={currentAdminId}
/>
```

### Pattern 2: Super Admin Platform Staff Invite
```typescript
<ClientEmployeeInvite 
  workspaceId={null}
  adminId={currentAdminId}
  isSuperAdmin={true}
/>
```

### Pattern 3: Super Admin Workspace Invite
```typescript
<ClientEmployeeInvite 
  workspaceId={targetWorkspaceId}
  adminId={currentAdminId}
  isSuperAdmin={true}
  defaultRole="manager"
/>
```

## RPC Call Examples

### What Gets Sent (Client Admin)
```json
{
  "p_email": "newemployee@example.com",
  "p_invited_by": "admin-uuid-123"
}
```

### What Gets Sent (Super Admin)
```json
{
  "p_email": "newemployee@example.com",
  "p_role": "employee",
  "p_workspace_id": "workspace-uuid-456",
  "p_invited_by": "admin-uuid-123"
}
```

### What Gets Sent (Super Admin - Platform Staff)
```json
{
  "p_email": "newstaff@example.com",
  "p_role": "admin",
  "p_workspace_id": null,
  "p_invited_by": "admin-uuid-123"
}
```

## Key Features Checklist

✅ Dynamic RPC parameters based on `isSuperAdmin` flag  
✅ Client admins send minimal params (no extra fields error)  
✅ Super admins can send all parameters  
✅ Email validation before submit  
✅ Loading spinner during submission  
✅ Form clears on success  
✅ Invites fetched on mount  
✅ Copy link button with state feedback  
✅ Toast notifications for all scenarios  
✅ Detailed console logging  
✅ Proper TypeScript types  
✅ Error handling for all edge cases  

## Integration Steps

1. **Import the component:**
   ```typescript
   import ClientEmployeeInvite from '@/components/ClientEmployeeInvite';
   ```

2. **Add to your page:**
   ```typescript
   export default function WorkspacePage() {
     return (
       <ClientEmployeeInvite 
         workspaceId={workspaceId}
         adminId={adminId}
       />
     );
   }
   ```

3. **Test the flow:**
   - Create an invite as client admin
   - Verify "Unexpected fields" error is gone
   - Copy link and verify format
   - Check console logs for debugging info

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unexpected fields" error | Ensure `isSuperAdmin={false}` (default) for client admins |
| RPC not working | Check `adminId` is valid UUID, check auth token |
| Copy not working | Ensure HTTPS or localhost, check console for errors |
| Invites not showing | Check workspace filter, verify RLS policies |

---

**File:** `/app/components/ClientEmployeeInvite.tsx`  
**Status:** ✅ Updated and Ready  
**Last Modified:** January 21, 2026
