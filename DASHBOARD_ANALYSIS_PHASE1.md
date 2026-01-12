# 📊 RETAIL ASSIST DASHBOARD - PHASE 1 ANALYSIS REPORT

**Date:** January 12, 2026  
**Status:** ✅ Auth FROZEN - All authentication/session/RLS boundaries are locked  
**Scope:** Dashboard feature scan, mock vs live detection, Phase 1 integration planning

---

## SECTION 1: DASHBOARD MAP (Per Page/Component)

### 1.1 Dashboard Overview Page (`/app/dashboard/page.tsx`)

**Location:** [/workspaces/retail-assist/app/dashboard/page.tsx](app/dashboard/page.tsx)

| Aspect | Details |
|--------|---------|
| **Components Used** | User data display, quick stats cards, channel status, CTA buttons |
| **Data Source** | `/api/auth/me` (live), `/api/inbox` (live), `/api/automation-rules` (live) |
| **Mock vs Live** | MIXED - Auth & counts are LIVE; pages & AI usage counts are TODO |
| **Feature Status** | Partially implemented - core dashboard loads, but some metrics missing |
| **Plan Gating** | ✅ Present - uses `plan_limits.hasInstagram`, `plan_type` check |
| **UX State** | Loading state via `setLoading()`, error handling basic |

**Key Data Fetches:**
```tsx
// LIVE - Fetches authenticated user
const res = await fetch('/api/auth/me');

// LIVE - Fetches inbox conversation count
const inboxRes = await fetch('/api/inbox');

// LIVE - Fetches automation rules count
const rulesRes = await fetch('/api/automation-rules');

// TODO - Not yet implemented
// pages: 0 (should fetch from /api/meta/pages)
// aiUsage: 0 (should track from AI generation logs)
```

**Backend Tables:**
- `users` (via `/api/auth/me`)
- `inbox` / conversations (via `/api/inbox`)
- `automation_rules` (via `/api/automation-rules`)
- `integrations` (not yet fetched)

**Issues Identified:**
- ⚠️ `pages` count hardcoded to 0
- ⚠️ `aiUsage` count hardcoded to 0
- ⚠️ Inbox fetch uses no `workspaceId` parameter (should be passed)
- ⚠️ No error boundary for individual failed requests

---

### 1.2 AI Agents Page (`/app/dashboard/agents/page.tsx`)

**Location:** [/workspaces/retail-assist/app/dashboard/agents/page.tsx](app/dashboard/agents/page.tsx)

| Aspect | Details |
|--------|---------|
| **Components Used** | Agent cards with edit/delete buttons, agent creation CTA |
| **Data Source** | **MOCK** - Hardcoded array of 2 sample agents |
| **Mock vs Live** | 100% MOCK 🚨 - No API calls; uses local state only |
| **Feature Status** | UI skeleton only - no backend integration |
| **Plan Gating** | ❌ Not implemented |
| **UX State** | Empty state shown; no loading indicator |

**Mock Data:**
```tsx
const [agents, setAgents] = useState<Agent[]>([
  {
    id: '1',
    agent_name: 'Sales Assistant',
    system_prompt: 'You are a friendly sales representative...',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    agent_name: 'Support Bot',
    system_prompt: 'You are a helpful customer support agent...',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
]);
```

**Backend Tables (Not Yet Connected):**
- `agents` table exists (schema ready in migration 002)
- Should fetch: `GET /api/agents` (endpoint exists but UI doesn't call it)

**Issues Identified:**
- 🚨 **MAJOR:** No API integration at all
- 🚨 Delete handler only filters local state (no backend persistence)
- ❌ No workspace scoping
- ❌ No loading/error states
- ❌ Links to edit/create go to routes that may not exist

---

### 1.3 Inbox Page (`/app/dashboard/inbox/page.tsx`)

**Location:** [/workspaces/retail-assist/app/dashboard/inbox/page.tsx](app/dashboard/inbox/page.tsx)

| Aspect | Details |
|--------|---------|
| **Components Used** | `ConversationsList`, `ConversationDetail`, reply input |
| **Data Source** | `/api/inbox` (live), `/api/inbox/{id}` (live), `/api/inbox/{id}/reply` (live) |
| **Mock vs Live** | ✅ 100% LIVE - Proper API integration |
| **Feature Status** | Core functionality working - conversations, messages, replies |
| **Plan Gating** | ⚠️ Not explicitly gated (should check `plan_limits.commentToDmLimit`) |
| **UX State** | Good - loading skeletons, error states, empty states |

**Data Flow:**
```tsx
// 1. Fetch workspace ID from auth
const authRes = await fetch('/api/auth/me');
const authData = await authRes.json();
setWorkspaceId(authData.user.id); // Uses user.id as workspace ID

// 2. List conversations
const res = await fetch(`/api/inbox?workspaceId=${workspaceId}`);
// Returns: { data: Conversation[] }

// 3. Get single conversation messages
const res = await fetch(`/api/inbox/${conversationId}`);
// Returns: { data: Message[] }

// 4. Mark as read
await fetch(`/api/inbox/${conversationId}/read`, { method: 'POST' });

// 5. Send reply
await fetch(`/api/inbox/${conversationId}/reply`, {
  method: 'POST',
  body: JSON.stringify({ content: string })
});
```

**Backend Tables:**
- `inbox` / conversations
- Message logs (implicit)
- RLS enforced via API

**Components:**

#### ConversationsList.tsx
- ✅ Fetches from `/api/inbox?workspaceId=...`
- ✅ Shows platform badges (FB/IG)
- ✅ Unread count indicator
- ✅ Loading & error states
- ⚠️ No pagination (could have perf issues with many conversations)

#### ConversationDetail.tsx
- ✅ Fetches from `/api/inbox/{id}`
- ✅ Marks conversation as read
- ✅ Parses message sources ([Workspace Rule], [Default AI])
- ✅ Error handling
- ⚠️ Fixed height scroll (max-h-96) - might be too small for long chats

#### ReplyInput.tsx
- ✅ Textarea with Shift+Enter support
- ✅ Disabled state during send
- ⚠️ No character limit warning
- ⚠️ No message validation

**Issues Identified:**
- ⚠️ Workspace ID derived from user.id (assumes 1:1 relationship)
- ⚠️ No usage tracking for comment-to-DM limit
- ⚠️ No platform-specific message limits
- ⚠️ Message parsing assumes specific prefixes

---

### 1.4 Analytics Page (`/app/dashboard/analytics/page.tsx`)

**Location:** [/workspaces/retail-assist/app/dashboard/analytics/page.tsx](app/dashboard/analytics/page.tsx)

| Aspect | Details |
|--------|---------|
| **Components Used** | 4 stat cards (messages, conversions, rate, response time) |
| **Data Source** | `mockAnalytics.getStats()` **MOCK ONLY** |
| **Mock vs Live** | 🚨 100% MOCK - No backend integration |
| **Feature Status** | UI skeleton only - placeholder numbers |
| **Plan Gating** | ❌ Not implemented |
| **UX State** | Simple loading state, no errors |

**Mock Data:**
```tsx
mockAnalytics.getStats() returns:
{
  totalMessages: 5234,
  conversions: 642,
  conversionRate: 12.2,
  avgResponseTime: 1.2,
  topAgents: ['Sales Assistant', 'Support Bot'],
}
```

**Backend Tables (Not Connected):**
- `daily_stats` - exists but not queried
- Should fetch: `GET /api/analytics/summary` (endpoint doesn't exist yet)

**Issues Identified:**
- 🚨 **CRITICAL:** Hardcoded mock data only
- ❌ No actual analytics engine
- ❌ No workspace scoping
- ❌ Charts mentioned in mock but not rendered
- ❌ No drill-down capabilities
- ❌ No date range filtering

---

### 1.5 Settings Page (`/app/dashboard/settings/page.tsx`)

**Location:** [/workspaces/retail-assist/app/dashboard/settings/page.tsx](app/dashboard/settings/page.tsx#L1-L100)

| Aspect | Details |
|--------|---------|
| **Components Used** | Form inputs for auto-reply, keywords, greeting messages |
| **Data Source** | `/api/settings` (live via file-based DB, not Supabase) |
| **Mock vs Live** | ✅ LIVE but via custom DB (not Supabase) |
| **Feature Status** | Core settings management working |
| **Plan Gating** | ⚠️ Not enforced (should check `plan_limits` for features) |
| **UX State** | Good - loading, success toast, error messages |

**Data Flow:**
```tsx
// Load settings
const res = await fetch('/api/settings');
const data = await res.json();
setSettings(data.settings);

// Save settings
const res = await fetch('/api/settings', {
  method: 'PUT',
  body: JSON.stringify(settings)
});
```

**Backend:**
- Uses file-based `db.settings` (custom DB, not Supabase)
- Session validated via `session_id` cookie
- ⚠️ **Auth-freeze boundary:** Uses legacy session manager, not Supabase auth

**Features Implemented:**
- ✅ Auto-reply toggle
- ✅ Comment-to-DM toggle
- ✅ Greeting & away messages
- ✅ Keyword management (add/remove)
- ✅ AI enable/disable
- ✅ System prompt customization

**Issues Identified:**
- ⚠️ Uses non-Supabase DB (file-based storage)
- ⚠️ No RLS (custom session validation only)
- ⚠️ AI response count limit not enforced
- ⚠️ Keyword limit not enforced
- ❌ No team permissions check
- ⚠️ Settings are user-level, not workspace-level

---

### 1.6 Billing Page (`/app/dashboard/billing/page.tsx`)

**Location:** [/workspaces/retail-assist/app/dashboard/billing/page.tsx](app/dashboard/billing/page.tsx)

| Aspect | Details |
|--------|---------|
| **Components Used** | Current plan display, upgrade CTA, payment method info |
| **Data Source** | `/api/auth/me` (live) for plan info; hardcoded prices |
| **Mock vs Live** | MIXED - User plan is live, but pricing is hardcoded |
| **Feature Status** | Read-only plan display; no upgrade flow |
| **Plan Gating** | N/A - this IS the gating page |
| **UX State** | Good - loading state, error handling |

**Data Flow:**
```tsx
const res = await fetch('/api/auth/me');
const data = await res.json();
// Returns user with: plan_type, plan_name, plan_limits, subscription_status, billing_end_date

const getPlanPrice = (planType: string): number => {
  const prices: { starter: 22, pro: 45, enterprise: 75 };
  return prices[planType] ?? 22;
};
```

**Backend Tables (Partially Connected):**
- `users.plan_type`, `plan_limits` ✅ Live
- `subscriptions` ❌ Not queried (billing_end_date only)
- `billing_payments` ❌ Not shown
- `invoices` ❌ Not shown

**Issues Identified:**
- ⚠️ Pricing hardcoded in frontend (should fetch from `/api/plans`)
- ⚠️ No payment history
- ⚠️ No invoice generation
- ⚠️ No upgrade workflow (just links to `/pricing`)
- ❌ PayPal payment link goes to external site (not in-app)
- ❌ No subscription management (pause, cancel, etc.)
- ⚠️ `plan_limits.price` used from user object (should come from plans table)

---

### 1.7 Integrations Page (`/app/dashboard/integrations/page.tsx`)

**Location:** [/workspaces/retail-assist/app/dashboard/integrations/page.tsx](app/dashboard/integrations/page.tsx)

| Aspect | Details |
|--------|---------|
| **Components Used** | Connected pages list, Meta OAuth flow, page selection |
| **Data Source** | `/api/meta/oauth`, `/api/meta/pages`, `/api/meta/disconnect` (live) |
| **Mock vs Live** | ✅ LIVE - Real Meta/Facebook OAuth integration |
| **Feature Status** | OAuth flow working; page management implemented |
| **Plan Gating** | ⚠️ Not enforced (should check `plan_limits.maxPages`) |
| **UX State** | Good - loading states, success/error messages |

**Data Flow:**
```tsx
// 1. Initiate OAuth
const res = await fetch('/api/meta/oauth');
// Returns: { authUrl: string }
// Redirects to Meta login

// 2. Handle callback with token
const success = searchParams.get('success');
const token = searchParams.get('token');
const pagesCount = searchParams.get('pages');
// Parses token to get list of available pages

// 3. Save selected pages
const res = await fetch('/api/meta/pages', {
  method: 'POST',
  body: JSON.stringify({ token, selectedPageIds })
});
// Returns: { pages: ConnectedPage[] }

// 4. Disconnect page
const res = await fetch('/api/meta/disconnect', {
  method: 'POST',
  body: JSON.stringify({ pageId })
});
```

**Backend Tables:**
- `integrations` ✅ Should track Meta tokens & page IDs
- `meta_pages` (implicit) ✅ Stores connected pages

**Issues Identified:**
- ⚠️ No page limit enforcement based on plan
- ⚠️ Token stored on client side (temporary) - need secure storage
- ⚠️ No token refresh flow shown
- ❌ Only Meta/Facebook supported (WhatsApp, Instagram not visible as separate)
- ❌ No integration status checking (are tokens expired?)
- ⚠️ No scoping validation (pages from different businesses)

---

### 1.8 Layout & Shared Components

#### Sidebar.tsx
**Location:** [/workspaces/retail-assist/app/components/Sidebar.tsx](app/components/Sidebar.tsx)

| Aspect | Details |
|--------|---------|
| **Purpose** | Main navigation menu |
| **Data** | None - static links |
| **Auth Boundary** | ⚠️ NOT touched (frozen) |
| **Features** | 6 nav items (Dashboard, Analytics, Agents, Integrations, Billing, Settings) |

#### Topbar.tsx
**Location:** [/workspaces/retail-assist/app/components/Topbar.tsx](app/components/Topbar.tsx)

| Aspect | Details |
|--------|---------|
| **Purpose** | Header with search, notifications, user menu |
| **Data** | None - static UI |
| **Auth Boundary** | ⚠️ Sign out button present (frozen) |
| **Issues** | Search not functional; notifications hardcoded |

#### SubscriptionGuard.tsx
**Location:** [/workspaces/retail-assist/app/components/SubscriptionGuard.tsx](app/components/SubscriptionGuard.tsx#L1-L150)

| Aspect | Details |
|--------|---------|
| **Purpose** | Subscription & access control wrapper |
| **Responsibility** | Check user status, show banners, block access if needed |
| **Auth Boundary** | 🔒 **FROZEN** - Do NOT modify |
| **Features** | Unpaid banner, awaiting approval banner, suspended access |
| **Data Source** | `/api/auth/me` |

**States Handled:**
- ✅ Loading
- ✅ `unpaid` - Shows yellow banner, allows read-only access
- ✅ `awaiting_approval` - Shows blue banner, allows access with notice
- ✅ `suspended` - Blocks access
- ✅ Feature gating (instagram, ai, comment_to_dm)

#### dashboard/layout.tsx
**Location:** [/workspaces/retail-assist/app/dashboard/layout.tsx](app/dashboard/layout.tsx)

| Aspect | Details |
|--------|---------|
| **Purpose** | Dashboard wrapper layout |
| **Auth Boundary** | ⚠️ Uses SubscriptionGuard (frozen) |
| **Structure** | Sidebar + Topbar + main content |
| **RLS** | ✅ Enforced at API level (routes handle it) |

---

## SECTION 2: MOCK VS LIVE SUMMARY

### 2.1 Live Features (Connected to Real Backend)

| Feature | Endpoint | Status | Notes |
|---------|----------|--------|-------|
| **Authentication** | `/api/auth/me` | ✅ LIVE | Returns user + plan info |
| **Inbox/Conversations** | `/api/inbox` | ✅ LIVE | Workspace-scoped, RLS enforced |
| **Inbox Messages** | `/api/inbox/{id}` | ✅ LIVE | Message fetch + mark as read |
| **Inbox Reply** | `/api/inbox/{id}/reply` | ✅ LIVE | Send reply to conversation |
| **Automation Rules List** | `/api/automation-rules` | ✅ LIVE | Fetch workspace rules |
| **Settings** | `/api/settings` | ✅ LIVE | Load/save (custom DB) |
| **Connected Pages** | `/api/meta/pages` | ✅ LIVE | Meta integration |
| **Meta OAuth** | `/api/meta/oauth` | ✅ LIVE | Initiate login |
| **Meta Disconnect** | `/api/meta/disconnect` | ✅ LIVE | Remove page connection |

### 2.2 Mock Features (No Backend Yet)

| Feature | Source | Status | Issue |
|---------|--------|--------|-------|
| **AI Agents List** | Local state | 🚨 MOCK | No `/api/agents` call |
| **Agent Create/Edit** | Forms only | ❌ NOT IMPL | UI but no backend |
| **Analytics** | `mockAnalytics` | 🚨 MOCK | Hardcoded numbers |
| **Analytics Charts** | `mockAnalytics` | 🚨 MOCK | Never rendered |

### 2.3 Hardcoded/Placeholder Data

| Location | Data | Should Be |
|----------|------|-----------|
| Agents page | 2 sample agents | Fetch from `/api/agents` |
| Analytics page | 5234 messages, 642 conversions | Aggregate from `daily_stats` |
| Dashboard page | `pages: 0` | Fetch from `/api/meta/pages` |
| Dashboard page | `aiUsage: 0` | Count from agent usage logs |
| Billing page | Prices {starter: 22, pro: 45, ...} | Fetch from `/api/plans` |
| Integrations page | Max pages check | Enforce per `plan_limits.maxPages` |

### 2.4 TODO/Not Implemented

```typescript
// In dashboard/page.tsx
pages: 0, // TODO: fetch from integrations
aiUsage: 0 // TODO: fetch AI usage

// In agents/page.tsx
// No API integration at all - entire page is mock

// In analytics/page.tsx
// Only stat cards shown; charts from mockAnalytics never rendered
const statsData = await mockAnalytics.getStats(); // Only this is called
// const chartsData = await mockAnalytics.getCharts(); // This exists but not called
```

---

## SECTION 3: PHASE 1 INTEGRATION TASKS (With Priority & Dependencies)

### 3.1 Critical Path Tasks (Must Complete for MVP)

#### Task P0.1: Integrate AI Agents Page with Live Data
**Priority:** P0 (Critical)  
**Dependencies:** `/api/agents` endpoint must exist & work  
**Complexity:** Medium  
**Files to Modify:** `app/dashboard/agents/page.tsx`

**Current State:**
```tsx
const [agents, setAgents] = useState<Agent[]>([
  // hardcoded sample agents
]);
```

**Changes Required:**
```tsx
// 1. Add useEffect to fetch agents on mount
useEffect(() => {
  loadAgents();
}, []);

const loadAgents = async () => {
  try {
    setLoading(true);
    const res = await fetch('/api/agents');
    if (res.ok) {
      const data = await res.json();
      setAgents(data.agents || []);
    } else {
      setError('Failed to load agents');
    }
  } finally {
    setLoading(false);
  }
};

// 2. Add loading skeleton
if (loading) return <LoadingSkeleton />;

// 3. Add error state
if (error) return <ErrorBanner message={error} />;

// 4. Fix delete handler to call API
const handleDelete = async (id: string) => {
  if (!confirm('...')) return;
  try {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAgents(agents.filter(a => a.id !== id));
    }
  } catch (err) {
    setError('Delete failed');
  }
};
```

**Acceptance Criteria:**
- [ ] Fetch agents on page load from `/api/agents`
- [ ] Display loading skeleton while fetching
- [ ] Show error banner if fetch fails
- [ ] Delete makes API call to `/api/agents/{id}`
- [ ] After delete, remove from local state
- [ ] Plan gating: Only show if `plan_limits.enabledAiAgents` = true
- [ ] Workspace scoping: Ensure only user's workspace agents shown

---

#### Task P0.2: Connect Analytics to Real Data
**Priority:** P0 (Critical)  
**Dependencies:** `/api/analytics/*` endpoints must exist  
**Complexity:** Medium-High  
**Files to Modify:** `app/dashboard/analytics/page.tsx`, create `/app/api/analytics/`

**Current State:**
```tsx
const statsData = await mockAnalytics.getStats(); // Returns hardcoded numbers
```

**Changes Required:**

1. **Create Analytics API endpoint** (`/api/analytics/summary`):
```typescript
// GET /api/analytics/summary?workspace_id={id}&period=30d
// Returns: { totalMessages, conversions, conversionRate, avgResponseTime }
```

2. **Update frontend to call live endpoint:**
```tsx
const loadAnalytics = async () => {
  const workspaceId = await getWorkspaceId();
  const res = await fetch(`/api/analytics/summary?workspaceId=${workspaceId}`);
  const data = await res.json();
  setStats(data);
};
```

3. **Calculate from actual tables:**
   - `totalMessages` = COUNT(*) FROM inbox WHERE workspace_id = ? AND created_at > ?
   - `conversions` = COUNT(*) FROM direct_messages WHERE workspace_id = ? AND status = 'sent'
   - `conversionRate` = conversions / totalMessages * 100
   - `avgResponseTime` = AVG(created_at - parent_message.created_at) FROM messages

**Acceptance Criteria:**
- [ ] Create `/api/analytics/summary` endpoint
- [ ] Fetch real data from inbox & direct_messages tables
- [ ] Return aggregated stats (messages, conversions, rate, response time)
- [ ] Support date range filtering (`period=7d|30d|90d|custom`)
- [ ] Workspace-scoped queries (RLS enforced)
- [ ] Cache results for 1 hour (optional, for perf)
- [ ] Load state with spinner
- [ ] Error state with retry button

---

#### Task P0.3: Fix Dashboard Overview Page Metrics
**Priority:** P0 (Critical)  
**Dependencies:** `/api/meta/pages` endpoint, Inbox data  
**Complexity:** Low-Medium  
**Files to Modify:** `app/dashboard/page.tsx`

**Current State:**
```tsx
setCounts({
  inbox: inboxData.conversations?.length || 0,
  rules: rulesData.length || 0,
  pages: 0, // ← TODO: fetch from integrations
  aiUsage: 0 // ← TODO: fetch AI usage
});
```

**Changes Required:**

1. **Fetch connected pages:**
```typescript
const pagesRes = await fetch('/api/meta/pages');
const pagesData = pagesRes.ok ? await pagesRes.json() : { pages: [] };

setCounts(prev => ({
  ...prev,
  pages: pagesData.pages?.length || 0
}));
```

2. **Fetch AI usage:**
```typescript
// Create new endpoint: GET /api/ai/usage?workspace_id={id}&period=month
const usageRes = await fetch(`/api/ai/usage?period=month`);
const usageData = usageRes.ok ? await usageRes.json() : { count: 0 };

setCounts(prev => ({
  ...prev,
  aiUsage: usageData.count || 0
}));
```

3. **Add workspace ID to inbox/rules fetches:**
```typescript
// Currently inbox fetch has no params - add workspaceId
const inboxRes = await fetch(`/api/inbox?workspaceId=${user.id}`);
const rulesRes = await fetch(`/api/automation-rules?workspace_id=${user.id}`);
```

**Acceptance Criteria:**
- [ ] Pages count fetched from `/api/meta/pages`
- [ ] AI usage fetched from `/api/ai/usage` (new endpoint)
- [ ] All 4 counts populated with real data
- [ ] Workspace ID passed to all API calls
- [ ] Fallback to 0 if API fails (no error shown)
- [ ] Update counts when SubscriptionGuard allows user in

---

### 3.2 High Priority Tasks (Phase 1 - Core Features)

#### Task P1.1: Add Feature Gating to Dashboard Pages
**Priority:** P1 (High)  
**Dependencies:** SubscriptionGuard, plan_limits in user object  
**Complexity:** Low  
**Files to Modify:** Multiple pages

**Current Issues:**
- Inbox page allows usage without checking `plan_limits.commentToDmLimit`
- Agents page allows creation without checking plan limits
- Integrations page allows adding pages without checking `plan_limits.maxPages`
- Analytics page shows for all plans (should only be Pro+)

**Changes Required:**

For each page, wrap content with feature check:

```tsx
// In agents/page.tsx
if (!user?.plan_limits?.enabledAiAgents) {
  return <FeatureLockedBanner 
    feature="AI Agents" 
    requiredPlan="Pro"
    upgradePath="/pricing"
  />;
}

// In integrations/page.tsx
const connectedCount = connectedPages.length;
const maxAllowed = user?.plan_limits?.maxPages || 1;
if (connectedCount >= maxAllowed) {
  return <FeatureLockedBanner 
    message={`You can connect up to ${maxAllowed} pages on your plan`}
  />;
}

// In analytics/page.tsx
if (user?.plan_type === 'starter') {
  return <FeatureLockedBanner 
    feature="Advanced Analytics" 
    requiredPlan="Pro"
  />;
}
```

**Acceptance Criteria:**
- [ ] Analytics page gated to Pro+ plans
- [ ] Agents page gated based on `plan_limits.enabledAiAgents`
- [ ] Integrations page enforces `plan_limits.maxPages`
- [ ] Each page shows appropriate feature lock banner
- [ ] User can see upgrade CTA in banner

---

#### Task P1.2: Add Pagination & Filtering to Lists
**Priority:** P1 (High)  
**Dependencies:** Backend pagination support  
**Complexity:** Medium  
**Files to Modify:** 
- `app/components/inbox/ConversationsList.tsx`
- `app/dashboard/agents/page.tsx`

**Current Issues:**
- ConversationsList has no pagination (could load hundreds of items)
- Agents page will have perf issues if user has many agents
- No filtering/search on any list

**Changes Required:**

```tsx
// Add pagination hooks
const [page, setPage] = useState(1);
const [limit] = useState(20);
const [total, setTotal] = useState(0);

// Modify fetch URL
const url = `/api/inbox?workspaceId=${workspaceId}&page=${page}&limit=${limit}`;
const res = await fetch(url);
const data = await res.json();
setTotal(data.total); // Backend should return total count
setConversations(data.data);

// Add pagination UI
<PaginationControls 
  page={page} 
  pageSize={limit}
  total={total}
  onPageChange={setPage}
/>
```

**Acceptance Criteria:**
- [ ] ConversationsList fetches with limit=20
- [ ] Backend returns `{ data, total, page }`
- [ ] Pagination buttons at bottom of list
- [ ] Page state resets when filters change
- [ ] Loading indicator shows while fetching

---

#### Task P1.3: Implement Workspace Scoping Consistently
**Priority:** P1 (High)  
**Dependencies:** User session with workspace_id  
**Complexity:** Low-Medium  
**Files to Modify:** All dashboard pages

**Current Issues:**
- Some pages use `user.id` as workspace (assumes 1:1)
- Some pages have no workspace parameter
- Settings page is user-level, not workspace-level

**Changes Required:**

1. **Determine workspace_id on mount:**
```tsx
useEffect(() => {
  const getWorkspaceId = async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    // TODO: Return workspace_id from auth/me
    // Currently only returns user.id
    const workspaceId = data.user.workspace_id || data.user.id;
    setWorkspaceId(workspaceId);
  };
  getWorkspaceId();
}, []);
```

2. **Pass workspace_id to all API calls:**
```tsx
fetch(`/api/agents?workspace_id=${workspaceId}`)
fetch(`/api/inbox?workspace_id=${workspaceId}`)
fetch(`/api/automation-rules?workspace_id=${workspaceId}`)
```

3. **Update `/api/auth/me` to include workspace_id:**
```typescript
// Return: { user: { id, email, workspace_id, plan_type, ... } }
```

**Acceptance Criteria:**
- [ ] `/api/auth/me` returns `workspace_id`
- [ ] All dashboard pages fetch workspace_id on mount
- [ ] All API calls include `workspace_id` parameter
- [ ] Backend verifies user has access to workspace (RLS)

---

### 3.3 Medium Priority Tasks (Phase 1 - Enhancement)

#### Task P2.1: Implement Inbox Usage Tracking
**Priority:** P2 (Medium)  
**Dependencies:** `/api/inbox`, usage logging  
**Complexity:** Medium  
**Files to Modify:** Inbox page, settings page

**Current Issues:**
- Comment-to-DM limit (`plan_limits.commentToDmLimit`) not enforced
- No warning when approaching limit
- No usage breakdown (which channels used most)

**Changes Required:**

1. **Track usage in inbox reply:**
```typescript
const handleReply = async (content: string) => {
  try {
    const res = await fetch(`/api/inbox/${conversationId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    
    if (res.ok) {
      const data = await res.json();
      // data includes: { success, usedCount, remainingLimit }
      setUsageCount(data.usedCount);
      
      if (data.usedCount >= data.limit * 0.8) {
        showWarning(`${data.limit - data.usedCount} replies remaining`);
      }
    }
  } catch (err) {
    // handle error
  }
};
```

2. **Show usage meter in settings:**
```tsx
<UsageMeter 
  label="Comment-to-DM Replies"
  used={usageData.replies.used}
  limit={user.plan_limits.commentToDmLimit}
  resetDate={getBillingCycleEnd(user.billing_end_date)}
/>
```

**Acceptance Criteria:**
- [ ] Track DM replies sent via API
- [ ] Show warning at 80% usage
- [ ] Block new replies at 100% usage
- [ ] Show usage meter in settings
- [ ] Include reset date in meter

---

#### Task P2.2: Create Plan Management UI
**Priority:** P2 (Medium)  
**Dependencies:** `/api/plans`, `/api/billing/upgrade`  
**Complexity:** Medium-High  
**Files to Modify:** `app/dashboard/billing/page.tsx`, create upgrade flow

**Current Issues:**
- Billing page is read-only; no upgrade workflow
- Pricing hardcoded, not fetched
- No plan comparison
- No subscription management (pause, cancel, renew)

**Changes Required:**

1. **Fetch actual plans:**
```typescript
const res = await fetch('/api/plans');
const plans = await res.json();
// Returns: { plans: [{ id, name, price_monthly, features, ... }] }
```

2. **Show plan comparison:**
```tsx
<PlansGrid plans={plans} currentPlan={user.plan_type} onUpgrade={handleUpgrade} />
```

3. **Implement upgrade flow:**
```typescript
const handleUpgrade = async (planId: string) => {
  const res = await fetch('/api/billing/upgrade', {
    method: 'POST',
    body: JSON.stringify({ planId })
  });
  // Redirect to checkout or process payment
};
```

**Acceptance Criteria:**
- [ ] Fetch plans from `/api/plans`
- [ ] Show plan grid with features
- [ ] Current plan highlighted
- [ ] Upgrade button triggers checkout
- [ ] Support pause/cancel/renew actions
- [ ] Show invoice history

---

#### Task P2.3: Build Automation Rules UI
**Priority:** P2 (Medium)  
**Dependencies:** `/api/automation-rules` CRUD endpoints  
**Complexity:** Medium  
**Files to Modify:** 
- Create `app/dashboard/automation-rules/page.tsx`
- Create `/app/api/automation-rules/` POST/PUT/DELETE handlers

**Current Issues:**
- Automation rules list endpoint exists but no UI
- Create/edit forms not implemented
- No test/preview functionality

**Changes Required:**

Already detected in semantic search:
- `app/dashboard/inbox-automation/page.tsx` exists (shows empty state)
- `app/dashboard/inbox-automation/new/page.tsx` exists (form for new rule)

But need to:
1. Replace hardcoded empty state with real data
2. Fix form to call backend create API
3. Add edit page
4. Add test button to preview rule execution

---

### 3.4 Blocking Issues (Must Resolve Before Phase 1)

#### ⚠️ Blocker B1: Workspace ID Not in Auth Response
**Impact:** All dashboard pages need workspace_id  
**Current State:** `/api/auth/me` only returns user.id  
**Fix:** Update endpoint to query workspaces table and return workspace_id

```typescript
// In /api/auth/me/route.ts
const { data: workspace } = await supabase
  .from('workspaces')
  .select('id')
  .eq('owner_id', user.id)
  .limit(1)
  .single();

return NextResponse.json({
  user: {
    ...user,
    workspace_id: workspace?.id || user.id
  }
});
```

---

#### ⚠️ Blocker B2: Settings Page Uses Non-Supabase DB
**Impact:** Auth is frozen; can't add settings to Supabase RLS yet  
**Current State:** Uses file-based `db.settings` with custom session validation  
**Risk:** Inconsistent with rest of app; breaks multi-workspace support  
**Plan:** Keep as-is for now; migrate in Phase 2 (after auth review)

---

#### ⚠️ Blocker B3: Analytics Endpoints Don't Exist
**Impact:** Can't populate analytics page with real data  
**Current State:** Only mock data available  
**Solution:** Create `/api/analytics/*` endpoints with aggregation queries

```typescript
// POST-PHASE1 Task: Create endpoints
// GET /api/analytics/summary - overall stats
// GET /api/analytics/daily - daily breakdown
// GET /api/analytics/agents - per-agent breakdown
```

---

## SECTION 4: NOTES & POTENTIAL BLOCKERS

### 4.1 Auth Freeze Impact

✅ **SAFE TO PROCEED:** All identified integration tasks work within frozen boundaries.

**Frozen Elements (DO NOT TOUCH):**
- `app/api/auth/*` - All auth routes
- `app/components/SubscriptionGuard.tsx` - Access control
- `app/middleware.ts` - Route protection
- `supabase/migrations/` - Any RLS policies
- Session cookies & validation
- User provisioning flow
- Signup/login pages

**OK TO MODIFY:**
- Dashboard content pages (agents, inbox, analytics, etc.)
- Settings page (already using non-Supabase DB)
- Billing page (read-only is fine)
- API endpoints for non-auth features (agents, inbox, automation)

---

### 4.2 Database Schema Status

**✅ READY:** All tables exist in schema (migration 002):
- `workspaces` ✅
- `agents` ✅
- `automation_rules` ✅
- `inbox` ✅ (implied via conversations)
- `direct_messages` ✅
- `daily_stats` ✅
- `integrations` ✅
- `subscriptions` ✅
- `users` ✅ (from auth)

**❌ NOT IMPLEMENTED:** Queries for:
- Analytics aggregation
- Usage tracking
- Plan enforcement
- Workspace scoping in some endpoints

---

### 4.3 API Endpoint Status

| Endpoint | Exists | Status | Notes |
|----------|--------|--------|-------|
| `/api/auth/me` | ✅ | LIVE | Missing workspace_id |
| `/api/agents` | ✅ | LIVE | But UI doesn't call it |
| `/api/agents/{id}` | ✅ | LIVE | Edit/delete endpoints |
| `/api/automation-rules` | ✅ | LIVE | List works; create/delete unclear |
| `/api/inbox` | ✅ | LIVE | Working well |
| `/api/inbox/{id}` | ✅ | LIVE | Fetch messages |
| `/api/inbox/{id}/reply` | ✅ | LIVE | Send reply |
| `/api/meta/pages` | ✅ | LIVE | Integration works |
| `/api/meta/oauth` | ✅ | LIVE | OAuth flow |
| `/api/settings` | ✅ | LIVE | GET/PUT |
| `/api/analytics/*` | ❌ | MISSING | Need to create |
| `/api/ai/usage` | ❌ | MISSING | Need to create |
| `/api/plans` | ❌ | MISSING | Need to create |

---

### 4.4 Frontend State Management

**Current Approach:** React `useState` hooks  
**Issues:**
- No centralized state (leads to inconsistency)
- No caching (refetch on every mount)
- No optimistic updates
- No offline support

**Not Critical for Phase 1** - works fine for MVP, but consider for Phase 2:
- TanStack Query (React Query) for server state
- Zustand or Redux for client state

---

### 4.5 Performance Considerations

| Issue | Impact | Mitigation |
|-------|--------|-----------|
| No pagination in lists | Medium (500+ items) | Add limit=20 to API calls |
| No caching in analytics | Low (data updated daily) | Cache for 1 hour server-side |
| No lazy loading in inbox | Low (most users have <1000 convos) | Implement virtual scroll if needed |
| Large conversation chats | Low (max-h-96 scroll) | Paginate old messages |

---

### 4.6 Feature Gating Checklist

Current implementation in SubscriptionGuard:

| Feature | Check Implemented | Location |
|---------|------------------|----------|
| Instagram automation | ✅ | SubscriptionGuard |
| AI responses | ✅ | SubscriptionGuard |
| Comment-to-DM | ❌ | Not checked |
| Analytics access | ❌ | Not checked |
| Max pages connect | ❌ | Not checked |
| Max agents create | ❌ | Not checked |

**Action:** Add checks in each page component (P1.1 task above).

---

### 4.7 Error Handling & Edge Cases

| Scenario | Current | Needed |
|----------|---------|--------|
| Workspace not found | Basic error | Retry with user.id fallback |
| API rate limit | Not shown | Exponential backoff + user feedback |
| Large image uploads | Not relevant yet | Chunk upload for future |
| Stale data | No cache invalidation | Refresh button on each page |
| Concurrent edits | Not protected | Optimistic updates + conflict resolution |

---

### 4.8 Migration Path (Supabase DB - Settings)

**Current:** Settings use file-based DB  
**Timeline:** Phase 2 (after auth review)  
**Steps:**
1. Create `workspace_settings` table in Supabase
2. Add RLS policy (workspace members only)
3. Migrate settings queries to Supabase
4. Delete file-based DB code

---

## SECTION 5: PHASE 1 SUMMARY & RECOMMENDATIONS

### 5.1 What's Working Well ✅

1. **Inbox functionality is solid** - Live API integration, good UX
2. **Auth/subscription guard is robust** - Prevents unauthorized access
3. **Meta/Facebook integration flow works** - OAuth + page selection
4. **Layouts & navigation are clean** - Good structure for expansion
5. **Settings persistence works** - Save/load functions properly

### 5.2 What Needs Work 🔧

1. **Agents page needs backend integration** - Currently 100% mock
2. **Analytics needs real data source** - Only placeholder numbers
3. **Dashboard metrics incomplete** - Pages & AI usage not fetched
4. **Feature gating not consistent** - Some limits not enforced
5. **Workspace scoping incomplete** - Missing workspace_id in auth

### 5.3 Recommended Phase 1 Timeline

**Week 1: Critical Path**
- Task P0.1: Agents live integration (2-3 days)
- Task P0.2: Analytics real data (2-3 days)
- Task P0.3: Dashboard metrics fix (1 day)
- Task B1: Add workspace_id to auth (1 day)

**Week 2: High Priority**
- Task P1.1: Feature gating (1-2 days)
- Task P1.2: Pagination (1-2 days)
- Task P1.3: Workspace scoping (1 day)

**Week 3: Medium Priority**
- Task P2.1: Usage tracking (2-3 days)
- Task P2.2: Plan management UI (2-3 days)
- Task P2.3: Automation rules UI (2-3 days)

### 5.4 Success Criteria for Phase 1

- [ ] All dashboard pages fetch live data (no mock)
- [ ] Feature gating enforced on all pages
- [ ] Workspace scoping consistent across all APIs
- [ ] Usage limits tracked and enforced
- [ ] All lists paginated (limit=20)
- [ ] Error states shown on all pages
- [ ] Loading states present on all async operations
- [ ] Auth freeze boundaries maintained (no changes to auth/*/)
- [ ] RLS policies verified at database level

### 5.5 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Breaking auth during changes | Low | Critical | Code review checklist; test auth paths |
| Missing workspace scoping | Medium | High | Add workspace_id to all queries |
| Users see partial data | Medium | Medium | Cache validation; refresh buttons |
| Plan limits not enforced | Medium | High | Feature gating in P1.1 |
| Performance issues | Low | Medium | Add pagination in P1.2 |

---

**Report Completed:** January 12, 2026  
**Analyst:** GitHub Copilot  
**Next Steps:** Review this report, prioritize tasks, begin P0.1 implementation
