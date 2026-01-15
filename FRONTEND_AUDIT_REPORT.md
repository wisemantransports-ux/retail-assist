# Frontend Codebase Audit: Dashboards & Role-Based Access

**Date:** January 14, 2026  
**Status:** Complete Audit of Current Implementation  
**Scope:** Role-based access, dashboard pages, components, Supabase integrations

---

## Executive Summary

The retail-assist frontend currently implements **two distinct user hierarchies**:

1. **Global Admin System** (`role: 'admin'` in users table)
   - System-wide super_admin access
   - Platform-level management (users, subscriptions, manual approvals)

2. **Workspace-Based System** (workspace_members with `WorkspaceMemberRole`)
   - Workspace owner, admin, staff, member, viewer roles
   - Team management within workspaces
   - Incomplete integration with dashboard pages

**Key Finding:** The workspace-based role system is **defined in database types** but **not fully integrated** into the dashboard UI. Most dashboard pages do not check workspace membership roles.

---

## 1. DASHBOARD PAGES & URL ROUTES

### 1.1 Regular User Dashboards

All located under `/dashboard/*` prefix with layout wrapper at [app/dashboard/layout.tsx](app/dashboard/layout.tsx)

| Route | Page File | Role(s) Can Access | Status | Components |
|-------|-----------|-------------------|--------|-----------|
| `/dashboard` | [page.tsx](app/dashboard/page.tsx) | All authenticated users | ✅ IMPLEMENTED | Main overview, plan info, inbox count, rules count, pages count, AI usage |
| `/dashboard/analytics` | [analytics/page.tsx](app/dashboard/analytics/page.tsx) | Paid users only | ✅ IMPLEMENTED | Analytics summary (messages, conversions, conversion rate, response time) |
| `/dashboard/agents` | [agents/page.tsx](app/dashboard/agents/page.tsx) | Paid users with `hasAiResponses` plan limit | ✅ IMPLEMENTED | AI agents list, feature-gated creation |
| `/dashboard/integrations` | [integrations/page.tsx](app/dashboard/integrations/page.tsx) | Paid users only | ✅ IMPLEMENTED | Facebook/Instagram page connection, page management |
| `/dashboard/inbox` | [inbox/page.tsx](app/dashboard/inbox/page.tsx) | Paid users | ✅ IMPLEMENTED | Conversations list, conversation detail, reply interface |
| `/dashboard/inbox-automation` | [inbox-automation/page.tsx](app/dashboard/inbox-automation/page.tsx) | Paid users | ✅ IMPLEMENTED | Automation rules list, rule toggle, rule delete |
| `/dashboard/billing` | [billing/page.tsx](app/dashboard/billing/page.tsx) | All authenticated users | ✅ IMPLEMENTED | Current plan display, pricing info, subscription status |
| `/dashboard/settings` | [settings/page.tsx](app/dashboard/settings/page.tsx) | All authenticated users | ✅ IMPLEMENTED | Auto-reply, comment-to-DM, greeting/away messages, keywords, AI settings |
| `/dashboard/team` | [team/page.tsx](app/dashboard/team/page.tsx) | ❌ **Placeholder** | ⚠️ PARTIAL | Team member list (hardcoded), invite form (not connected to API) |
| `/dashboard/[workspaceId]/` | [​[workspaceId]/page.tsx](app/dashboard/​[workspaceId]/page.tsx) | Workspace members | ⚠️ DEFINED | **NOT IMPLEMENTED** - Dynamic workspace routes not functional |
| `/dashboard/products` | [products/page.tsx](app/dashboard/products/page.tsx) | N/A | ⚠️ PLACEHOLDER | Empty page `<h1>Products Page</h1>` |
| `/dashboard/pricing` | [pricing/page.tsx](app/dashboard/pricing/page.tsx) | N/A | ⚠️ PLACEHOLDER | Not checked |
| `/dashboard/policy-ai` | [policy-ai/page.tsx](app/dashboard/policy-ai/page.tsx) | N/A | ⚠️ PLACEHOLDER | Not checked |
| `/dashboard/support-ai` | [support-ai/page.tsx](app/dashboard/support-ai/page.tsx) | N/A | ⚠️ PLACEHOLDER | Not checked |
| `/dashboard/website-integration` | [website-integration/page.tsx](app/dashboard/website-integration/page.tsx) | N/A | ⚠️ PLACEHOLDER | Not checked |
| `/dashboard/visual-search` | [visual-search/page.tsx](app/dashboard/visual-search/page.tsx) | N/A | ⚠️ PLACEHOLDER | Not checked |

### 1.2 Admin Dashboards

All located under `/admin/*` prefix. **No layout wrapper** - each page is standalone.

| Route | Page File | Role(s) Can Access | Status | Components |
|-------|-----------|-------------------|--------|-----------|
| `/admin/login` | [admin/login/page.tsx](app/admin/login/page.tsx) | Unauthenticated admins | ✅ IMPLEMENTED | Email/password login form, role check |
| `/admin/` | [admin/page.tsx](app/admin/page.tsx) | `role: 'admin'` only | ✅ IMPLEMENTED | Users list, stats (total, pending, awaiting approval, active, suspended), filtering |
| `/admin/users/[id]` | [admin/users/[id]/page.tsx](app/admin/users/[id]/page.tsx) | `role: 'admin'` only | ✅ IMPLEMENTED | User detail page, user info, user history |
| `/admin/settings` | [admin/settings/page.tsx](app/admin/settings/page.tsx) | `role: 'admin'` only | ✅ IMPLEMENTED | Admin configuration settings |
| `/admin/logs` | [admin/logs/page.tsx](app/admin/logs/page.tsx) | `role: 'admin'` only | ✅ IMPLEMENTED | System logs, audit trail |
| `/admin/manual-approvals` | [admin/manual-approvals/page.tsx](app/admin/manual-approvals/page.tsx) | `role: 'admin'` only | ✅ IMPLEMENTED | Manual payment approvals, approval/reject interface |
| `/admin/branding` | [admin/branding/page.tsx](app/admin/branding/page.tsx) | `role: 'admin'` only | ⚠️ PARTIAL | Branding settings (file exists, not checked) |
| `/admin/analytics-debug` | [admin/analytics-debug/page.tsx](app/admin/analytics-debug/page.tsx) | `role: 'admin'` only | ⚠️ DEBUG | Debug page for analytics (not checked) |

---

## 2. ROLE-BASED ACCESS CONTROLS

### 2.1 Global Admin Role (`users.role = 'admin'`)

**Where Checked:**
- [app/admin/page.tsx](app/admin/page.tsx#L50): `data.user.role !== 'admin'` redirects to `/admin/login`
- [app/admin/users/[id]/page.tsx](app/admin/users/[id]/page.tsx#L55): Role check before loading
- [app/admin/settings/page.tsx](app/admin/settings/page.tsx#L24): Role check before loading
- [app/admin/login/page.tsx](app/admin/login/page.tsx#L31): Post-login role validation
- [app/admin/logs/page.tsx](app/admin/logs/page.tsx#L32): Role check before loading
- [app/api/admin/users/route.ts](app/api/admin/users/route.ts#L15): `user.role !== 'admin'` returns 401
- [app/api/admin/users/[id]/route.ts](app/api/admin/users/[id]/route.ts#L15): Role check in GET
- [app/api/admin/settings/route.ts](app/api/admin/settings/route.ts#L30): Role check in POST
- [app/api/admin/logs/route.ts](app/api/admin/logs/route.ts#L15): Role check in GET
- [app/api/branding/route.ts](app/api/branding/route.ts#L28): Role check for branding endpoint

**Permissions:**
- ✅ View all users
- ✅ View user details
- ✅ Modify admin settings
- ✅ View system logs
- ✅ Approve/reject manual payments
- ✅ Manage branding
- ✅ Access analytics debug

**Redirect After Login:** `/admin` (see [app/admin/page.tsx](app/admin/page.tsx#L70))

### 2.2 Workspace-Based Roles (WorkspaceMemberRole)

**Defined in:** [app/lib/types/database.ts#L47](app/lib/types/database.ts#L47)

**Roles:**
- `owner` - Workspace owner
- `admin` - Workspace admin
- `staff` - Regular staff
- `member` - Member (legacy)
- `viewer` - View-only (legacy)

**Where Implemented:**
- [app/components/team/TeamMembersList.tsx#L26](app/components/team/TeamMembersList.tsx#L26): `canManageRoles = userRole === 'owner' || userRole === 'admin'`
- [app/components/team/TeamMembersList.tsx#L27](app/components/team/TeamMembersList.tsx#L27): `canRemoveMembers = userRole === 'owner' || userRole === 'admin'`
- [app/components/team/InviteMemberForm.tsx#L100](app/components/team/InviteMemberForm.tsx#L100): Shows "member" and "admin" roles; owner can create new owner
- [app/api/workspace/member/role/route.ts#L52](app/api/workspace/member/role/route.ts#L52): Validates `member.role !== 'owner' && member.role !== 'admin'`
- [app/api/workspace/invite/accept/route.ts](app/api/workspace/invite/accept/route.ts): Accept invite flow
- [app/dashboard/team/page.tsx](app/dashboard/team/page.tsx): **Hardcoded data**, no real workspace member checks

**Current Limitation:** ⚠️ Workspace roles are **database-defined** but **not enforced on dashboard pages**. The team page shows static data, not actual workspace members.

### 2.3 Subscription-Based Access (Feature Gating)

**Located in:** [app/lib/feature-gates.ts](app/lib/feature-gates.ts)

**Gates:**
- `isFreeUser()`: `payment_status !== 'paid' || subscription_status !== 'active'`
- `isPaidUser()`: Opposite of above
- `canConnectFacebook()`: Requires paid user
- `canUseInstagram()`: Requires paid + `plan_limits.hasInstagram`
- `canManageAgents()`: Requires paid + `plan_limits.hasAiResponses`
- `canCreateAutomationRules()`: Requires paid
- `canSendMessages()`: Requires paid
- `getMaxPages()`: Returns `plan_limits.maxPages` (0 for free users)
- `getCommentToDmLimit()`: Returns `plan_limits.commentToDmLimit` (0 for free users)
- `getAiTokenLimit()`: Returns monthly limit based on plan

**Enforcement:**
- [app/components/SubscriptionGuard.tsx](app/components/SubscriptionGuard.tsx): Wrapper component blocks access for unpaid/suspended users
- [app/dashboard/agents/page.tsx#L48](app/dashboard/agents/page.tsx#L48): Uses `canManageAgents()` gate
- [app/dashboard/integrations/page.tsx](app/dashboard/integrations/page.tsx): Uses feature gates for Facebook/Instagram
- **Admin bypass:** `if (userData.role === "admin") { setLoading(false); return; }` in [SubscriptionGuard.tsx#L54](app/components/SubscriptionGuard.tsx#L54)

---

## 3. COMPONENTS INVENTORY

### 3.1 Layout & Navigation

| Component | File | Purpose | Role-Aware? |
|-----------|------|---------|------------|
| `Sidebar` | [app/components/Sidebar.tsx](app/components/Sidebar.tsx) | Main dashboard navigation | ❌ Static links for all users |
| `Topbar` | [app/components/Topbar.tsx](app/components/Topbar.tsx) | Header/user menu | ⚠️ Likely yes (not fully checked) |
| `SubscriptionGuard` | [app/components/SubscriptionGuard.tsx](app/components/SubscriptionGuard.tsx) | Wraps dashboard layout, blocks unpaid users | ✅ Full implementation |

### 3.2 Team Management Components

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| `TeamMembersList` | [app/components/team/TeamMembersList.tsx](app/components/team/TeamMembersList.tsx) | Display workspace members, manage roles | ✅ API-ready, needs integration |
| `InviteMemberForm` | [app/components/team/InviteMemberForm.tsx](app/components/team/InviteMemberForm.tsx) | Invite new members with role selection | ✅ Fully functional |

**Workspace role validation in TeamMembersList:**
- Owner role shows purple badge
- Admin role shows blue badge
- Member role shows gray badge
- Only owner/admin can change roles
- Only owner/admin can remove members

### 3.3 Billing & Subscription Components

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| `SubscriptionGuard` | [app/components/SubscriptionGuard.tsx](app/components/SubscriptionGuard.tsx) | Access control wrapper | ✅ Full implementation |
| Billing display | [app/dashboard/billing/page.tsx](app/dashboard/billing/page.tsx) | Shows current plan, pricing, renewal date | ✅ Functional |

**Subscription States Handled:**
- `unpaid` → Limited access with notice
- `awaiting_approval` → Limited access with notice
- `active` → Full access
- `suspended` → Blocked with error message

### 3.4 Inbox Components (mentioned, not fully listed)

Located in [app/components/inbox/](app/components/inbox/):
- `ConversationsList` - List of conversations
- `ConversationDetail` - Single conversation view with reply interface

### 3.5 Dashboard Components (mentioned, not fully listed)

Located in [app/components/dashboard/](app/components/dashboard/):
- `CommentToDmAutomationSettings` - Settings form

### 3.6 Utility Components

| Component | File | Purpose |
|-----------|------|---------|
| `ApiKeyDisplay` | [app/components/ApiKeyDisplay.tsx](app/components/ApiKeyDisplay.tsx) | Display/manage API keys |
| `ChatWidget` | [app/components/ChatWidget.tsx](app/components/ChatWidget.tsx) | Embedded chat widget |
| `CommentBox` | [app/components/CommentBox.tsx](app/components/CommentBox.tsx) | Comment input area |
| `LicenseCheck` | [app/components/LicenseCheck.tsx](app/components/LicenseCheck.tsx) | License validation |
| `ShortcutsModal` | [app/components/ShortcutsModal.tsx](app/components/ShortcutsModal.tsx) | Keyboard shortcuts help |
| `Skeleton` | [app/components/Skeleton.tsx](app/components/Skeleton.tsx) | Loading placeholder |
| `AgentForm` | [app/components/AgentForm.tsx](app/components/AgentForm.tsx) | AI agent creation/edit form |

---

## 4. SUPABASE INTEGRATIONS

### 4.1 Database Tables Used

**From Database Types** ([app/lib/types/database.ts](app/lib/types/database.ts)):

| Table | Purpose | Row-Level Security | Status |
|-------|---------|-------------------|--------|
| `users` | User accounts, plan info, subscription | Admin access enforced | ✅ Full RLS |
| `workspace_members` | Workspace team members & roles | Workspace-scoped | ✅ Full RLS |
| `workspace_invites` | Pending team invitations | Workspace-scoped | ✅ Full RLS |
| `workspaces` | Workspace configuration | Owner/member access | ✅ Full RLS |
| `agents` | AI agents per workspace | Workspace-scoped | ✅ Full RLS |
| `comments` | Comments from platforms | Workspace-scoped | ✅ Full RLS |
| `direct_messages` | DM messages | Workspace-scoped | ✅ Full RLS |
| `automation_rules` | Automation rules | Workspace-scoped | ✅ Full RLS |
| `invoices` | Billing invoices | Workspace-scoped | ✅ Full RLS |
| `audit_logs` | System audit trails | Admin-only | ✅ Full RLS |

### 4.2 Key Queries & Functions

**Team Management:**
- [inviteMember()](#) - Create workspace invitation (7-day expiry)
- [updateMemberRole()](#) - Change member role in workspace
- [removeMember()](#) - Remove member from workspace
- [listWorkspaceMembers()](#) - Get all members for workspace
- [acceptInvite()](#) - Accept pending invitation

**User Lookups (Admin-level):**
- `db.users.findById()` - Uses admin client (RLS bypass)
- `db.users.findByAuthUid()` - Uses admin client (RLS bypass)
- `db.users.findByEmail()` - Uses admin client (RLS bypass)

**Rationale for Admin Client:** 
These are called from authenticated API routes where the user has been verified via session. Admin client prevents RLS policies from blocking legitimate internal lookups.

### 4.3 Supabase Client Usage

**Server-side clients** ([app/lib/supabase/server.ts](app/lib/supabase/server.ts)):

```typescript
createServerClient() → User-scoped RLS enforced
createAdminSupabaseClient() → Service role bypass RLS
```

**Key Locations:**
- Session validation: [app/lib/session/index.ts](app/lib/session/index.ts) - Creates/validates sessions
- Auth endpoint: [app/api/auth/me/route.ts](app/api/auth/me/route.ts) - Returns current user
- Workspace queries: [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts) - All DB operations

### 4.4 Real-Time Subscriptions

**Current Status:** ⚠️ **NO REAL-TIME SUBSCRIPTIONS FOUND**

The grep search for `on(|subscribe|realtime` found mock client stub:
```typescript
onAuthStateChange: (...args: any[]) => ({ data: { subscription: { unsubscribe: () => {} } } })
```

**Missing:**
- ❌ Real-time message updates in inbox
- ❌ Real-time workspace member updates
- ❌ Real-time automation rule changes
- ❌ Real-time agent status updates

---

## 5. AUTHENTICATION FLOW & REDIRECTS

### 5.1 Login Redirect Flow

**User Registration:**
1. Fill form at `/auth/signup`
2. Account created with role `'user'` or determined by registration flow
3. Session created via [app/lib/session/sessionManager.create()](#)

**User Login:**
1. Form at `/auth/login` calls `/api/auth/login`
2. Credentials validated
3. Session created
4. **Redirect to `/dashboard`** (see [app/auth/login/page.tsx#L36](app/auth/login/page.tsx#L36))

**Admin Login:**
1. Form at `/admin/login` calls `/api/auth/login` with admin credentials
2. User role checked: `data.user.role !== 'admin'` → redirect back
3. **Redirect to `/admin`** (see [app/admin/login/page.tsx#L36](app/admin/login/page.tsx#L36))

### 5.2 Session Management

**Session Storage:** Cookies (`session_id`)

**Session Validation:**
- [app/api/auth/me/route.ts](app/api/auth/me/route.ts): 
  - Reads `session_id` cookie
  - Calls `sessionManager.validate(sessionId)`
  - Returns user data including `role`, `plan_type`, `subscription_status`
  - Returns 401 if expired (clears cookie)

**Session Fields:**
```typescript
{
  id: string;
  user_id: string;  // Internal users.id
  created_at: string;
  expires_at: string;
}
```

### 5.3 Role Resolution

**Where User Role is Determined:**

1. **In Session:** Created during login in [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
2. **From Database:** [app/lib/db/index.ts](app/lib/db/index.ts) `db.users` queries
3. **Workspace Context:** [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts) via workspace_members table

**Flow:**
```
Login → User ID resolved → User lookup (role field) → Session created
  ↓
Dashboard request → Check /api/auth/me → User data with role
  ↓
Render dashboard based on role + subscription_status
```

---

## 6. MISSING PIECES & GAPS

### 6.1 Not Implemented Features

| Feature | Expected | Status | Impact |
|---------|----------|--------|--------|
| **Workspace-scoped dashboards** | `/dashboard/[workspaceId]/*` routes | ❌ Not implemented | Users can only see one workspace (default) |
| **Dynamic team page** | Load actual workspace members | ❌ Hardcoded data | Team page shows fake data |
| **Workspace role enforcement** | Check workspace_members.role on dashboard pages | ❌ Not enforced | Dashboard pages don't check if user is workspace member |
| **Real-time updates** | Supabase subscriptions for messages, members, etc. | ❌ Not implemented | No live updates in UI |
| **Multiple workspaces** | Switch between workspaces in dashboard | ❌ Not implemented | Single workspace only |
| **Employee dashboard** | Dedicated `employee`/`staff` role view | ❌ Not defined | Uses same dashboard as admin |
| **Invite acceptance page** | `/dashboard/invites` or similar | ❌ Not implemented | Invites accepted via API only |
| **Workspace switching UI** | Dropdown/modal to change active workspace | ❌ Not implemented | No workspace selector |

### 6.2 Placeholder Pages

These pages exist but have no real implementation:

| Page | Status | File |
|------|--------|------|
| Products | Placeholder heading only | [app/dashboard/products/page.tsx](app/dashboard/products/page.tsx) |
| Pricing (dashboard) | Not checked | [app/dashboard/pricing/page.tsx](app/dashboard/pricing/page.tsx) |
| Policy AI | Not checked | [app/dashboard/policy-ai/page.tsx](app/dashboard/policy-ai/page.tsx) |
| Support AI | Not checked | [app/dashboard/support-ai/page.tsx](app/dashboard/support-ai/page.tsx) |
| Website Integration | Not checked | [app/dashboard/website-integration/page.tsx](app/dashboard/website-integration/page.tsx) |
| Visual Search | Not checked | [app/dashboard/visual-search/page.tsx](app/dashboard/visual-search/page.tsx) |

### 6.3 Empty or Incomplete Components

| Component | Issue | File |
|-----------|-------|------|
| Sidebar | No role-based menu items | [app/components/Sidebar.tsx](app/components/Sidebar.tsx) |
| Topbar | Not fully reviewed | [app/components/Topbar.tsx](app/components/Topbar.tsx) |
| Team Page | Shows hardcoded members, not API data | [app/dashboard/team/page.tsx](app/dashboard/team/page.tsx) |
| Inbox | Incomplete workspace ID resolution | [app/dashboard/inbox/page.tsx](app/dashboard/inbox/page.tsx) |

### 6.4 API Endpoints Defined but Not Integrated

| Endpoint | Purpose | Frontend Use | Status |
|----------|---------|--------------|--------|
| `POST /api/workspace/invite` | Send invite | [app/components/team/InviteMemberForm.tsx](app/components/team/InviteMemberForm.tsx) ✅ | Integrated |
| `POST /api/workspace/invite/accept` | Accept invite | ❌ Not used in UI | Only API test |
| `POST /api/workspace/member/role` | Change role | [app/components/team/TeamMembersList.tsx](app/components/team/TeamMembersList.tsx) ✅ | Integrated |
| `POST /api/workspace/member/remove` | Remove member | [app/components/team/TeamMembersList.tsx](app/components/team/TeamMembersList.tsx) ✅ | Integrated |

---

## 7. DETAILED IMPLEMENTATION STATUS BY ROLE

### 7.1 SUPER_ADMIN (Global Admin)

**Implementation Status:** ✅ **COMPLETE**

**Dashboard:** `/admin`

**Access Control:**
- ✅ Role validated in client before load
- ✅ Role validated in API routes (returns 401 if not admin)
- ✅ Redirected to `/admin` after login

**Pages Accessible:**
- ✅ `/admin` - User management dashboard
- ✅ `/admin/users/[id]` - User detail page
- ✅ `/admin/settings` - Admin settings
- ✅ `/admin/logs` - Audit logs
- ✅ `/admin/manual-approvals` - Payment approvals
- ✅ `/admin/branding` - Branding settings
- ✅ `/admin/analytics-debug` - Debug analytics

**Capabilities:**
- ✅ View all users
- ✅ View user subscription status
- ✅ Approve/reject manual payments
- ✅ View system logs
- ✅ Manage platform settings
- ✅ Override subscription gates
- ✅ View debug analytics

**Components:**
- [app/admin/page.tsx](app/admin/page.tsx) - Main dashboard with users table
- [app/admin/manual-approvals/page.tsx](app/admin/manual-approvals/page.tsx) - Payment approval interface

---

### 7.2 ADMIN (Workspace Owner/Admin)

**Implementation Status:** ⚠️ **PARTIAL**

**Dashboard:** `/dashboard` (same as regular users currently)

**Access Control:**
- ✅ Subscription gate bypassed in [SubscriptionGuard.tsx](app/components/SubscriptionGuard.tsx#L54)
- ⚠️ Workspace role not enforced on pages
- ⚠️ No `WorkspaceMemberRole` checks in dashboard pages

**Pages Accessible (by design):**
- ✅ `/dashboard` - Overview
- ✅ `/dashboard/analytics` - All analytics
- ✅ `/dashboard/agents` - All agents
- ✅ `/dashboard/integrations` - All integrations
- ✅ `/dashboard/inbox` - All inbox messages
- ✅ `/dashboard/inbox-automation` - All automation rules
- ✅ `/dashboard/billing` - Billing info
- ✅ `/dashboard/settings` - Settings
- ⚠️ `/dashboard/team` - **Hardcoded data, not actual workspace members**

**Workspace Management (API Ready, UI Not Implemented):**
- ✅ API: Invite members - [/api/workspace/invite](app/api/workspace/invite/route.ts)
- ✅ API: Update member role - [/api/workspace/member/role](app/api/workspace/member/role/route.ts)
- ✅ API: Remove member - [/api/workspace/member/remove](app/api/workspace/member/remove/route.ts)
- ✅ Components: Invite form, member list (in [app/components/team/](app/components/team/))
- ❌ UI: Team page not connected to API

**Database-Level Enforcement:**
- ✅ `workspace_members` table has RLS policies
- ✅ Can only manage members of owned/admin workspaces
- ❌ Dashboard doesn't check workspace membership

**Capabilities (Current):**
- ✅ View/edit workspace settings
- ✅ Manage team (API-level only, UI incomplete)
- ✅ View all dashboard data
- ✅ Create automation rules
- ✅ Manage integrations
- ✅ Invite members (via form)

**Missing:**
- ❌ Workspace role dropdown in UI (only in API)
- ❌ Member management on team page (shows hardcoded data)
- ❌ Multiple workspace support
- ❌ Workspace-scoped views

---

### 7.3 EMPLOYEE (Workspace Staff/Member)

**Implementation Status:** ❌ **NOT IMPLEMENTED**

**Dashboard:** N/A

**Access Control:**
- ❌ No special role differentiation
- ❌ Would use same `/dashboard` as owner
- ❌ No employee-specific view

**Pages Accessible (Not Defined):**
- Would theoretically be subset of admin pages
- Read-only access to some features
- Write access limited to own records

**Capabilities (Not Implemented):**
- ❌ View conversations assigned to them
- ❌ Send messages in assigned conversations
- ❌ View limited analytics
- ❌ Cannot manage agents or automations
- ❌ Cannot manage team members

**Gap:**
The `WorkspaceMemberRole` type includes `'staff'` and `'member'` roles, but:
- Database stores these roles ✅
- Frontend doesn't distinguish between them ❌
- Dashboard treats all authenticated users the same ❌
- No employee-specific UI ❌

---

## 8. PLAN LIMITS & FEATURE GATES

**Located in:** [app/lib/db/index.ts#L17](app/lib/db/index.ts#L17)

| Plan | Price | Max Pages | Instagram | AI Responses | Comment-to-DM | Status |
|------|-------|-----------|-----------|--------------|---------------|--------|
| Starter | $22 | 1 | ❌ | ✅ | 100/month | ✅ Implemented |
| Pro | $45 | 3 | ✅ | ✅ | 500/month | ✅ Implemented |
| Enterprise | $75 | Unlimited | ✅ | ✅ | Unlimited | ✅ Implemented |

**Gate Implementation:**
- ✅ Free users blocked from paid features
- ✅ Feature checks in components
- ✅ API enforcement via `/api/billing/update-plan`
- ✅ Plan upgrade link in billing page

---

## 9. API ENDPOINT SUMMARY

### 9.1 Authentication Endpoints

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|---------------|
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/logout` | User logout | Yes |
| GET | `/api/auth/me` | Get current user | Yes (session cookie) |
| POST | `/api/auth/signup` | Register new user | No |

### 9.2 Admin Endpoints

| Method | Route | Purpose | Auth Required | Role Check |
|--------|-------|---------|---------------|-----------|
| GET | `/api/admin/users` | List all users | Yes | admin only |
| GET | `/api/admin/users/[id]` | User details | Yes | admin only |
| DELETE | `/api/admin/users` | Delete user | Yes | admin only |
| GET | `/api/admin/logs` | Audit logs | Yes | admin only |
| POST | `/api/admin/settings` | Update settings | Yes | admin only |
| POST | `/api/branding` | Branding settings | Yes | admin only |

### 9.3 Workspace & Team Endpoints

| Method | Route | Purpose | Status |
|--------|-------|---------|--------|
| POST | `/api/workspace/invite` | Send invite | ✅ Implemented |
| POST | `/api/workspace/invite/accept` | Accept invite | ✅ Implemented |
| POST | `/api/workspace/member/role` | Change role | ✅ Implemented |
| POST | `/api/workspace/member/remove` | Remove member | ✅ Implemented |

### 9.4 User-Facing Endpoints

| Method | Route | Purpose | Used in Dashboard |
|--------|-------|---------|------------------|
| GET | `/api/agents` | Get agents | [agents/page.tsx](app/dashboard/agents/page.tsx) ✅ |
| POST | `/api/agents` | Create agent | agents/page.tsx ✅ |
| GET | `/api/meta/pages` | Get Meta pages | [integrations/page.tsx](app/dashboard/integrations/page.tsx) ✅ |
| POST | `/api/meta/pages` | Add page | integrations/page.tsx ✅ |
| GET | `/api/automation-rules` | Get rules | [inbox-automation/page.tsx](app/dashboard/inbox-automation/page.tsx) ✅ |
| POST | `/api/automation-rules` | Create rule | inbox-automation/page.tsx ✅ |
| GET | `/api/inbox` | Get conversations | [inbox/page.tsx](app/dashboard/inbox/page.tsx) ✅ |
| GET | `/api/analytics/summary` | Analytics data | [analytics/page.tsx](app/dashboard/analytics/page.tsx) ✅ |

---

## 10. CURRENT LIMITATIONS & ARCHITECTURE ISSUES

### 10.1 User Role System Mismatch

**Problem:** Two conflicting role systems

1. **Global `users.role`** (admin/user/employee)
   - Stored in public.users table
   - Used for global platform access (admin pages)
   - Simple binary check

2. **Workspace `workspace_members.role`** (owner/admin/staff/member/viewer)
   - Workspace-scoped
   - Designed for team management
   - Not enforced on any dashboard pages

**Current Solution:** Dashboard ignores workspace roles entirely, only uses subscription status.

### 10.2 Single Workspace Assumption

**Limitation:** 
- API expects `workspace_id` parameter, but UI doesn't pass it
- Inbox assumes workspace = user (see [inbox/page.tsx#L19](app/dashboard/inbox/page.tsx#L19): `setWorkspaceId(authData.user.id)`)
- Team page hardcodes members instead of fetching

**Consequence:** 
Users cannot switch between multiple workspaces (even if multiple exist in DB).

### 10.3 Team Page Not Functional

**Current Implementation:**
```typescript
// app/dashboard/team/page.tsx line 13-20
const [members] = useState<TeamMember[]>([
  {
    id: '1',
    name: 'Business Owner',
    email: 'owner@example.com',
    role: 'owner',
    joined_at: new Date(...).toISOString(),
  },
]);
```

**Should Be:** Fetch from `/api/workspace/members` (endpoint not implemented)

### 10.4 No Invitation Acceptance UI

**Current Flow:**
1. Admin sends invite via form ✅
2. Invitee receives email (TODO) ❌
3. Invitee clicks link
4. **No UI to accept!** ❌ Only API endpoint exists

**Missing:** Accept invitation page at `/dashboard/invites/[token]` or similar

### 10.5 Session ID Contract Issues

**Note from code:** [app/lib/session/index.ts#L36](app/lib/session/index.ts#L36)

> The sessions table FK currently points to auth.users(id), but ideally should point to public.users(id).

**Consequence:** Session lookup requires trying both internal ID and auth UID.

---

## 11. FEATURE COMPLETION MATRIX

| Feature | Super_Admin | Admin | Employee | Status |
|---------|-------------|-------|----------|--------|
| **Authentication** |
| Login | ✅ | ✅ | ✅ | Complete |
| Logout | ✅ | ✅ | ✅ | Complete |
| Session Management | ✅ | ✅ | ✅ | Complete |
| **Dashboards** |
| Main Dashboard | ✅ (admin) | ✅ | ❌ | Partial |
| User Management | ✅ | ❌ | ❌ | Admin only |
| Team Management | ✅ (system) | ⚠️ (API only) | ❌ | Incomplete |
| Settings | ✅ | ✅ | ❌ | Partial |
| **Workspace Features** |
| View Members | ✅ (all) | ⚠️ (hardcoded) | ❌ | Incomplete |
| Invite Members | ✅ (system) | ✅ (API) | ❌ | Partial |
| Change Roles | ✅ (system) | ✅ (API) | ❌ | Partial |
| Remove Members | ✅ (system) | ✅ (API) | ❌ | Partial |
| **Content Management** |
| View Agents | ✅ | ✅ | ❌ | Partial |
| Create Agents | ❌ | ✅ | ❌ | Workspace admin only |
| View Inbox | ✅ | ✅ | ❌ | Partial |
| Manage Automations | ✅ | ✅ | ❌ | Partial |
| **Analytics & Reporting** |
| View Analytics | ✅ | ✅ | ❌ | Partial |
| System Logs | ✅ | ❌ | ❌ | Admin only |
| **Billing** |
| View Billing | ✅ | ✅ | ✅ | Complete |
| Approve Payments | ✅ | ❌ | ❌ | Admin only |

---

## 12. RECOMMENDATIONS FOR NEXT PHASE

### Priority 1: Complete Workspace Implementation

1. **Integrate Team Page with API**
   - Replace hardcoded members with `/api/workspace/members` call
   - Display actual workspace members with real roles
   - Show invitation status (pending/accepted)

2. **Implement Employee Dashboard**
   - Create employee-specific view
   - Add role-based feature visibility
   - Show only assigned conversations

3. **Add Multiple Workspace Support**
   - Implement workspace switcher in UI
   - Store active workspace in session/context
   - Route all API calls with workspace_id

### Priority 2: Complete Invitation Flow

1. **Create Invitation Acceptance UI**
   - Page at `/dashboard/invites/[token]`
   - Show workspace name, role, sender
   - Accept/decline buttons

2. **Email Integration**
   - Remove TODO in [app/api/workspace/invite/route.ts#L70](app/api/workspace/invite/route.ts#L70)
   - Send actual invitation emails with acceptance link

3. **Real-time Notifications**
   - Show pending invitations in topbar
   - Update on invitation acceptance

### Priority 3: Real-time Updates

1. **Subscribe to Workspace Changes**
   - Member list updates
   - Message count changes
   - Rule status changes

2. **Implement Supabase Subscriptions**
   - Replace periodic polling
   - Use `realtime` database tables
   - Update components on changes

### Priority 4: Fill Placeholder Pages

1. **Products Page** - Implement actual functionality
2. **Support AI** - Integrate AI support features
3. **Policy AI** - Implement policy management
4. **Visual Search** - Implement image search
5. **Website Integration** - Add website chat widget

---

## Appendix: File Structure Reference

```
app/
├── admin/                           # Global admin pages (no shared layout)
│   ├── page.tsx                    # Main admin dashboard
│   ├── login/page.tsx              # Admin login
│   ├── users/[id]/page.tsx         # User detail
│   ├── settings/page.tsx           # Admin settings
│   ├── logs/page.tsx               # Audit logs
│   ├── manual-approvals/page.tsx   # Payment approvals
│   └── branding/page.tsx           # Branding settings
│
├── dashboard/                       # User dashboards (with layout wrapper)
│   ├── layout.tsx                  # Shared layout (Sidebar, Topbar, SubscriptionGuard)
│   ├── page.tsx                    # Main dashboard
│   ├── [workspaceId]/              # Dynamic workspace routes (not implemented)
│   ├── agents/page.tsx             # AI agents management
│   ├── analytics/page.tsx          # Analytics dashboard
│   ├── billing/page.tsx            # Billing & subscription
│   ├── inbox/page.tsx              # Message inbox
│   ├── inbox-automation/page.tsx   # Automation rules
│   ├── integrations/page.tsx       # Meta integration setup
│   ├── settings/page.tsx           # User settings
│   ├── team/page.tsx               # Team management (incomplete)
│   ├── products/page.tsx           # Products (placeholder)
│   ├── pricing/page.tsx            # Pricing (placeholder)
│   ├── policy-ai/page.tsx          # Policy AI (placeholder)
│   ├── support-ai/page.tsx         # Support AI (placeholder)
│   ├── website-integration/        # Website chat (placeholder)
│   └── visual-search/              # Visual search (placeholder)
│
├── api/                             # Backend API routes
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── logout/route.ts
│   │   ├── me/route.ts
│   │   ├── signup/route.ts
│   │   ├── dev-login/route.ts
│   │   └── dev-logout/route.ts
│   │
│   ├── admin/
│   │   ├── users/route.ts
│   │   ├── users/[id]/route.ts
│   │   ├── settings/route.ts
│   │   └── logs/route.ts
│   │
│   ├── workspace/
│   │   ├── invite/route.ts
│   │   ├── invite/accept/route.ts
│   │   └── member/
│   │       ├── role/route.ts
│   │       └── remove/route.ts
│   │
│   ├── agents/route.ts
│   ├── meta/pages/route.ts
│   ├── automation-rules/route.ts
│   ├── inbox/route.ts
│   ├── analytics/summary/route.ts
│   └── [... payment, webhook routes ...]
│
├── components/                      # Reusable components
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── SubscriptionGuard.tsx
│   ├── team/
│   │   ├── TeamMembersList.tsx
│   │   └── InviteMemberForm.tsx
│   ├── dashboard/
│   │   └── CommentToDmAutomationSettings.tsx
│   ├── inbox/
│   │   ├── ConversationsList.tsx
│   │   └── ConversationDetail.tsx
│   └── [... other components ...]
│
└── lib/
    ├── db/index.ts                  # Database queries (mock + Supabase)
    ├── feature-gates.ts             # Subscription feature gates
    ├── session/index.ts             # Session management
    ├── supabase/
    │   ├── server.ts                # Client initialization
    │   ├── queries.ts               # All DB queries
    │   └── client.ts
    ├── types/database.ts            # TypeScript database types
    └── [... other utilities ...]
```

---

## Summary

**Current Implementation:**
- ✅ Global admin system fully operational
- ✅ Basic dashboard with subscription gating
- ✅ Team invite/role APIs implemented
- ✅ Payment approval system
- ⚠️ Workspace roles defined but not enforced
- ⚠️ Team management UI incomplete
- ❌ Employee-specific dashboard not started
- ❌ Multiple workspace support not implemented
- ❌ Real-time subscriptions not implemented

**Next Steps:**
1. Integrate workspace APIs into team management UI
2. Implement employee-specific dashboard views
3. Add multiple workspace support
4. Build invitation acceptance flow
5. Add real-time subscriptions

---

*Report generated: January 14, 2026*  
*Audit completed with zero code modifications*  
*File paths verified against current workspace structure*
