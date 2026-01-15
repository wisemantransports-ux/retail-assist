# Role Hierarchy - Quick Reference

## New Role System

### User Roles (System-Level)
```typescript
type UserRole = 'super_admin' | 'admin' | 'user' | null;
```

| Role | Purpose | Access |
|------|---------|--------|
| `super_admin` | Platform administrator | `/admin` dashboard, manage all users, system settings |
| `admin` | Workspace administrator | `/dashboard`, full feature access, manage team |
| `user` | Regular user | `/dashboard`, limited by subscription and workspace role |

### Workspace Member Roles (Workspace-Level)
```typescript
type WorkspaceMemberRole = 'owner' | 'admin' | 'staff' | 'member';
```

| Role | Purpose | Permissions |
|------|---------|-------------|
| `owner` | Workspace owner | Full workspace control |
| `admin` | Workspace admin | Can manage agents, automation, team |
| `staff` | Staff member | Can respond to messages, view data |
| `member` | Regular member | Read-only or limited access |

---

## Where to Check Roles

### Frontend - Check User Role
```tsx
// Get current user's role
const res = await fetch('/api/auth/me');
const { user } = await res.json();

if (user.role === 'super_admin') {
  // Show admin dashboard
}

if (user.role === 'admin') {
  // Show client dashboard
}
```

### Backend - Check User Role
```typescript
// In API routes
const user = await db.users.findById(userId);

if (user.role !== 'super_admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Workspace Member Role
```typescript
// In workspace-related operations
const { data: member } = await supabase
  .from('workspace_members')
  .select('role')
  .eq('user_id', userId)
  .eq('workspace_id', workspaceId)
  .single();

if (member.role !== 'admin' && member.role !== 'owner') {
  // User cannot manage this workspace
}
```

---

## Common Patterns

### Admin-Only Endpoint
```typescript
export async function GET(request: Request) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Admin-only logic
}
```

### Dashboard Access Guard
```tsx
export default function Dashboard() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  async function checkAuth() {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    
    if (!res.ok || data.user.role !== 'admin') {
      router.push('/dashboard/login');
      return;
    }
    
    setUser(data.user);
  }
}
```

### Feature Gate for Workspace Admin
```tsx
function canManageAgents(user) {
  // Workspace admins can always manage agents
  if (user.role === 'admin' || user.role === 'super_admin') {
    return true;
  }
  
  // Regular users need paid subscription
  return user.subscription_status === 'active';
}
```

---

## Database Queries

### Get User and Their Role
```sql
SELECT id, email, role FROM public.users WHERE email = 'user@example.com';
```

### Get Workspace Members with Their Roles
```sql
SELECT 
  wm.user_id,
  u.email,
  wm.role as workspace_role,
  u.role as user_role
FROM public.workspace_members wm
JOIN public.users u ON wm.user_id = u.id
WHERE wm.workspace_id = '...';
```

### Find All Super Admins
```sql
SELECT id, email, role FROM public.users WHERE role = 'super_admin';
```

### Find All Workspace Admins
```sql
SELECT DISTINCT u.id, u.email FROM public.users u
JOIN public.workspace_members wm ON u.id = wm.user_id
WHERE wm.role IN ('owner', 'admin');
```

---

## Auth Flow

### Login Response
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin",
    "subscription_status": "active",
    "plan_type": "pro"
  }
}
```

### Signup (Default Role)
- New users get role `null` initially
- Workspace is auto-created with user as `owner` in `workspace_members`
- First admin must be manually created with `super_admin` role

---

## Migration Reference

### From Old to New
```
OLD                    →  NEW
role: 'admin'         →  role: 'super_admin' (system admin)
role: null/undefined  →  role: 'admin' (workspace admin)
member.role: 'admin'  →  member.role: 'admin' (NO CHANGE - workspace level)
```

---

## Troubleshooting

### User Can't Access Admin Dashboard
Check: `SELECT role FROM public.users WHERE email = 'admin@example.com';`
- If `admin` → Update database to `super_admin`
- If `user` → Grant `super_admin` role

### User Can't Access Client Dashboard
Check: `SELECT role FROM public.users WHERE email = 'user@example.com';`
- If NULL → User role is OK, check subscription status
- If `super_admin` → Super admin can access, check redirects

### Permission Denied on API Endpoint
Check: `SELECT user.role, member.role FROM ... WHERE user_id = '...'`
- For `/api/admin/*` → User must have `super_admin` role
- For workspace endpoints → Check `workspace_members.role`

---

## Security Notes

⚠️ **Always check role on backend** - Never trust client-side role checks  
⚠️ **Workspace admins are not super admins** - They don't access `/admin`  
⚠️ **Member roles are workspace-scoped** - Different from user roles  
⚠️ **Audit admin actions** - Log all super admin operations

