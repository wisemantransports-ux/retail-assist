# 📋 DASHBOARD COMPONENT INVENTORY

## Page-by-Page Checklist

### ✅ Dashboard Home (`/dashboard/page.tsx`)
**Location:** [app/dashboard/page.tsx](app/dashboard/page.tsx)

**Status:** ⚠️ Partial - Core working, metrics incomplete

| Component | State | Source | Issue |
|-----------|-------|--------|-------|
| User Info Card | LIVE | `/api/auth/me` | ✅ Working |
| Inbox Count | LIVE | `/api/inbox` | ✅ Working |
| Rules Count | LIVE | `/api/automation-rules` | ✅ Working |
| Pages Count | MOCK | Hardcoded | ⚠️ Always shows 0 |
| AI Usage Count | MOCK | Hardcoded | ⚠️ Always shows 0 |
| Channel Status | MOCK | Local state | ⚠️ Shows facebook/instagram: false |
| Plan Info | LIVE | User object | ✅ Shows plan_type, plan_limits |

**Fixes Needed (P0.3):**
```tsx
// Add page count fetch
const pagesRes = await fetch('/api/meta/pages');
const pagesData = pagesRes.ok ? await pagesRes.json() : { pages: [] };

// Add AI usage fetch (new endpoint)
const usageRes = await fetch('/api/ai/usage?period=month');
const usageData = usageRes.ok ? await usageRes.json() : { count: 0 };
```

---

### 🚨 AI Agents (`/dashboard/agents/page.tsx`)
**Location:** [app/dashboard/agents/page.tsx](app/dashboard/agents/page.tsx)

**Status:** 🚨 Critical - 100% Mock, No Backend

| Feature | State | Issue |
|---------|-------|-------|
| List Agents | MOCK | Hardcoded 2 agents in useState |
| Delete Agent | LOCAL | Removes from state only, no API call |
| Create Link | BROKEN | Links to `/dashboard/agents/new` (may not exist) |
| Edit Link | BROKEN | Links to `/dashboard/agents/{id}` (may not exist) |
| Loading State | MISSING | No loading indicator |
| Empty State | OK | Shows "No agents created yet" |
| Plan Gating | MISSING | Not checked |

**Code Problems:**
```tsx
// ❌ PROBLEM: Hardcoded mock data, no fetch
const [agents, setAgents] = useState<Agent[]>([
  {
    id: '1',
    agent_name: 'Sales Assistant',
    // ...
  },
  {
    id: '2',
    agent_name: 'Support Bot',
    // ...
  },
]);

// ❌ PROBLEM: Delete only modifies local state
const handleDelete = (id: string) => {
  if (confirm('...')) {
    setAgents(agents.filter((a) => a.id !== id)); // No API call!
  }
};
```

**Fix (P0.1):**
```tsx
// ✅ SOLUTION: Fetch from API
const [agents, setAgents] = useState<Agent[]>([]);
const [loading, setLoading] = useState(true);

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
    }
  } finally {
    setLoading(false);
  }
};

// ✅ SOLUTION: Delete calls API
const handleDelete = async (id: string) => {
  if (!confirm('...')) return;
  try {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAgents(agents.filter(a => a.id !== id));
    }
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
};
```

**Backend Endpoint Status:**
```
✅ GET /api/agents                   - Returns agents list (but UI doesn't call)
✅ POST /api/agents                  - Create agent (form may call this)
✅ GET /api/agents/{id}              - Get single agent (form may call)
✅ PUT /api/agents/{id}              - Update agent (form may call)
❓ DELETE /api/agents/{id}           - Delete agent (need to verify)
```

---

### 🚨 Analytics (`/dashboard/analytics/page.tsx`)
**Location:** [app/dashboard/analytics/page.tsx](app/dashboard/analytics/page.tsx)

**Status:** 🚨 Critical - 100% Mock, No Backend

| Feature | State | Source | Issue |
|---------|-------|--------|-------|
| Total Messages | MOCK | mockAnalytics.getStats() | Always 5234 |
| Conversions | MOCK | mockAnalytics.getStats() | Always 642 |
| Conversion Rate | MOCK | mockAnalytics.getStats() | Always 12.2% |
| Avg Response Time | MOCK | mockAnalytics.getStats() | Always 1.2s |
| Charts | NOT RENDERED | mockAnalytics.getCharts() | Function exists, never called |
| Date Range | NOT IMPLEMENTED | N/A | No date picker |
| Plan Gating | MISSING | N/A | Should be Pro+ only |

**Code Problems:**
```tsx
// ❌ PROBLEM: Only mock data, no real API
const [stats, setStats] = useState<any>(null);

useEffect(() => {
  const loadData = async () => {
    const statsData = await mockAnalytics.getStats(); // ONLY CALLS MOCK
    setStats(statsData);
  };
  loadData();
}, []);

// ❌ PROBLEM: Charts function exists but never rendered
export const mockAnalytics = {
  getStats: async () => { /* returns stats */ },
  getCharts: async () => { /* returns charts */ }, // ← NEVER CALLED
};
```

**Fix (P0.2):**
```tsx
// ✅ SOLUTION: Create /api/analytics/summary endpoint
// Then fetch from it:
const loadAnalytics = async () => {
  const res = await fetch(`/api/analytics/summary?period=30d`);
  const data = await res.json();
  setStats({
    totalMessages: data.totalMessages,
    conversions: data.conversions,
    conversionRate: data.conversionRate,
    avgResponseTime: data.avgResponseTime,
  });
};

// ✅ SOLUTION: Add date range & charts
const [period, setPeriod] = useState('30d');
const [charts, setCharts] = useState(null);

const loadCharts = async () => {
  const res = await fetch(`/api/analytics/charts?period=${period}`);
  const data = await res.json();
  setCharts(data);
};

// Render charts when data loads
{charts && (
  <ChartGrid 
    messagesPerDay={charts.messagesPerDay}
    conversionFunnel={charts.conversionFunnel}
  />
)}
```

**Backend Endpoints Needed:**
```
❌ GET /api/analytics/summary        - NOT CREATED (need to make)
❌ GET /api/analytics/charts         - NOT CREATED (need to make)
❌ GET /api/analytics/daily          - NOT CREATED (optional)
❌ GET /api/analytics/agents         - NOT CREATED (optional)
```

---

### ✅ Inbox (`/dashboard/inbox/page.tsx`)
**Location:** [app/dashboard/inbox/page.tsx](app/dashboard/inbox/page.tsx)

**Status:** ✅ Fully Working

| Component | State | Source | Notes |
|-----------|-------|--------|-------|
| ConversationsList | LIVE | `/api/inbox?workspaceId={id}` | ✅ Working perfectly |
| ConversationDetail | LIVE | `/api/inbox/{id}` | ✅ Shows messages |
| ReplyInput | LIVE | `/api/inbox/{id}/reply` | ✅ Sends replies |
| Loading States | OK | Skeleton loaders | ✅ Good UX |
| Error States | OK | Error banners | ✅ Good UX |
| Empty States | OK | No conversations msg | ✅ Good UX |

**Components Breakdown:**

#### ConversationsList.tsx
```typescript
// ✅ LIVE - Fetches from API
const res = await fetch(`/api/inbox?workspaceId=${workspaceId}`);
const data = await res.json();
setConversations(data.data || []);

// ✅ Shows platform badges (FB/IG)
// ✅ Shows unread counts
// ✅ Click to select conversation

// ⚠️ ISSUE: No pagination (could load 1000s of items)
// ⚠️ ISSUE: No search/filter
```

#### ConversationDetail.tsx
```typescript
// ✅ LIVE - Fetches messages for selected conversation
const res = await fetch(`/api/inbox/${conversationId}`);
const data = await res.json();
setMessages(data.data || []);

// ✅ Shows message thread
// ✅ Shows sender (customer/bot/agent)
// ✅ Parses message sources ([Workspace Rule], [Default AI])
// ✅ Marks conversation as read

// ⚠️ ISSUE: Max-h-96 scroll (600px height) - may be too small
// ⚠️ ISSUE: No pagination for old messages
```

#### ReplyInput.tsx
```typescript
// ✅ LIVE - Sends reply
const res = await fetch(`/api/inbox/${conversationId}/reply`, {
  method: 'POST',
  body: JSON.stringify({ content })
});

// ✅ Textarea with Shift+Enter for newline
// ✅ Disabled state while sending
// ⚠️ ISSUE: No character limit warning
// ⚠️ ISSUE: No message validation (empty check is basic)
```

**No Changes Needed** - This page is working well!

---

### ⚠️ Settings (`/dashboard/settings/page.tsx`)
**Location:** [app/dashboard/settings/page.tsx](app/dashboard/settings/page.tsx)

**Status:** ✅ Working (On Custom DB, Not Supabase)

| Feature | State | Backend | Notes |
|---------|-------|---------|-------|
| Load Settings | LIVE | `/api/settings` GET | ✅ Uses custom session manager |
| Save Settings | LIVE | `/api/settings` PUT | ✅ Persists successfully |
| Auto-reply Toggle | LIVE | DB field | ✅ Works |
| Comment-to-DM Toggle | LIVE | DB field | ✅ Works |
| Greeting Message | LIVE | DB field | ✅ Works |
| Away Message | LIVE | DB field | ✅ Works |
| Keywords | LIVE | DB field | ✅ Add/remove works |
| AI Enable | LIVE | DB field | ✅ Works |
| System Prompt | LIVE | DB field | ✅ Works |

**Data Flow:**
```typescript
// ✅ LIVE - Custom DB, not Supabase
// Uses: sessionManager + db.settings (file-based)
const session = await sessionManager.validate(sessionCookie.value);
const settings = await db.settings.findByUserId(session.user_id);

// ✅ PUT request saves to custom DB
const updatedSettings = await db.settings.update(userId, {
  auto_reply_enabled: body.auto_reply_enabled,
  // ... other fields
});
```

**Status Notes:**
- ✅ Core functionality working
- ⚠️ Uses non-Supabase DB (separate from rest of app)
- ❌ No workspace scoping (user-level settings, not workspace-level)
- ❌ No team permissions (anyone with session can change)
- **Migration Planned:** Phase 2 (after auth review)

---

### ⚠️ Billing (`/dashboard/billing/page.tsx`)
**Location:** [app/dashboard/billing/page.tsx](app/dashboard/billing/page.tsx)

**Status:** ⚠️ Partial - Read-Only

| Feature | State | Issue |
|---------|-------|-------|
| Current Plan Display | LIVE | ✅ Shows plan from user object |
| Plan Price | HARDCODED | ⚠️ Prices in frontend, not from DB |
| Status Badge | LIVE | ✅ Shows active/inactive |
| Renewal Date | LIVE | ✅ From user.billing_end_date |
| Upgrade Link | BROKEN | ❌ Links to `/pricing` (external page) |
| Manage Subscription | MISSING | ❌ No pause/cancel/renew options |
| Payment History | MISSING | ❌ No invoice list |
| Payment Method | INFO ONLY | ⚠️ Links to external PayPal |

**Code Problems:**
```tsx
// ❌ PROBLEM: Prices hardcoded in frontend
const getPlanPrice = (planType: string): number => {
  const prices: Record<string, number> = {
    starter: 22,      // ← Hardcoded
    pro: 45,          // ← Hardcoded
    enterprise: 75    // ← Hardcoded
  };
  return prices[planType] ?? 22;
};

// ⚠️ ISSUE: No subscription management
// No way to:
// - Pause subscription
// - Cancel subscription
// - View payment history
// - See invoice details
```

**Fix (P2.2):**
```tsx
// ✅ SOLUTION: Fetch prices from /api/plans
const [plans, setPlans] = useState([]);

useEffect(() => {
  const res = await fetch('/api/plans');
  const data = await res.json();
  setPlans(data.plans);
}, []);

// ✅ SOLUTION: Show plan comparison
// ✅ SOLUTION: Handle upgrade checkout
// ✅ SOLUTION: Add subscription management
```

**Backend Endpoints Needed:**
```
❌ GET /api/plans                    - NOT CREATED (need to make)
❌ POST /api/billing/upgrade         - NOT CREATED (need to make)
❌ POST /api/billing/pause           - NOT CREATED (need to make)
❌ POST /api/billing/cancel          - NOT CREATED (need to make)
❌ GET /api/billing/invoices         - NOT CREATED (need to make)
```

---

### ✅ Integrations (`/dashboard/integrations/page.tsx`)
**Location:** [app/dashboard/integrations/page.tsx](app/dashboard/integrations/page.tsx)

**Status:** ✅ Mostly Working

| Feature | State | Source | Notes |
|---------|-------|--------|-------|
| Connected Pages List | LIVE | `/api/meta/pages` | ✅ Shows all connected pages |
| Connect Facebook | LIVE | `/api/meta/oauth` | ✅ OAuth flow works |
| Select Pages | LIVE | Token parsing | ✅ Lets user pick pages |
| Save Pages | LIVE | `/api/meta/pages` POST | ✅ Persists selection |
| Disconnect Page | LIVE | `/api/meta/disconnect` | ✅ Removes from list |
| Success Messages | OK | Toast/banner | ✅ Good feedback |
| Error Messages | OK | Error display | ✅ Good error handling |

**Features Working:**
```typescript
// ✅ OAuth initiation
const res = await fetch('/api/meta/oauth');
const data = await res.json();
window.location.href = data.authUrl;

// ✅ Parse returned token with page list
const token = searchParams.get('token');
const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());

// ✅ Save selected pages
const res = await fetch('/api/meta/pages', {
  method: 'POST',
  body: JSON.stringify({ token, selectedPageIds })
});

// ✅ Disconnect page
const res = await fetch('/api/meta/disconnect', {
  method: 'POST',
  body: JSON.stringify({ pageId })
});
```

**Issues:**
- ⚠️ No max pages enforcement (should check `plan_limits.maxPages`)
- ⚠️ No validation that pages are from same business
- ⚠️ No token refresh status check
- ⚠️ Only shows Meta/Facebook (Instagram/WhatsApp not visible)

---

## Shared Components Status

### Sidebar.tsx
**Status:** ✅ Working  
**Data:** None (static navigation)  
**Auth Frozen:** YES (do not modify)

### Topbar.tsx
**Status:** ⚠️ Partial  
**Issues:**
- Search is non-functional
- Notifications hardcoded
- Sign out button present but frozen

### SubscriptionGuard.tsx
**Status:** ✅ Working  
**Data:** `/api/auth/me` (user status)  
**Auth Frozen:** YES (do not modify)
**Responsibility:** Access control, banners, feature gating

### dashboard/layout.tsx
**Status:** ✅ Working  
**Structure:** Sidebar + Topbar + content wrapper
**Auth Frozen:** YES (uses SubscriptionGuard)

---

## Summary Table

```
COMPONENT                  STATUS    LIVE/MOCK    PRIORITY
─────────────────────────────────────────────────────────────
Inbox                      ✅ GOOD   100% LIVE    Keep as-is
Settings                   ✅ GOOD   100% LIVE    Keep, migrate Phase 2
Integrations               ✅ GOOD   100% LIVE    Keep, add plan gating
Dashboard (overview)       ⚠️ PARTIAL MIXED       Fix metrics (P0.3)
Agents List                🚨 BAD    100% MOCK    Rewrite (P0.1)
Analytics                  🚨 BAD    100% MOCK    Rewrite (P0.2)
Billing                    ⚠️ PARTIAL PARTIAL     Add UI (P2.2)
Navigation                 ✅ GOOD   N/A          Keep as-is
Auth Guard                 ✅ GOOD   N/A          FROZEN
```

---

**Component Inventory Complete**  
**Ready for Implementation Planning**
