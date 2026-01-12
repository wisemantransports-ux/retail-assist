# ✅ DASHBOARD PHASE 1 IMPLEMENTATION CHECKLIST

## Overview
This checklist guides Phase 1 implementation. Use the task IDs to track progress.

---

## WEEK 1: CRITICAL PATH (P0 Tasks + Blocker)

### Day 1: Unblock Everything (Task B1 + Setup)

- [ ] **B1.1** Review `/api/auth/me/route.ts`
- [ ] **B1.2** Add workspace query to find user's workspace
  ```typescript
  const workspace = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .single();
  ```
- [ ] **B1.3** Update response to include `workspace_id`
  ```typescript
  return NextResponse.json({
    user: { ...user, workspace_id: workspace?.id || user.id }
  });
  ```
- [ ] **B1.4** Test that `/api/auth/me` returns `workspace_id` ✅
- [ ] **B1.5** Verify no auth changes violate freeze boundaries ✅

### Day 2-3: Fix Agents Page (Task P0.1)

**File:** `app/dashboard/agents/page.tsx`

- [ ] **P0.1.1** Remove hardcoded agent array from initial state
- [ ] **P0.1.2** Add state variables:
  ```tsx
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  ```
- [ ] **P0.1.3** Create `loadAgents()` function that calls `/api/agents`
- [ ] **P0.1.4** Call `loadAgents()` in `useEffect` on mount
- [ ] **P0.1.5** Add loading skeleton while `loading === true`
  ```tsx
  if (loading) return <LoadingSkeleton />;
  ```
- [ ] **P0.1.6** Add error banner if fetch fails
  ```tsx
  if (error) return <ErrorBanner message={error} />;
  ```
- [ ] **P0.1.7** Fix `handleDelete()` to call API:
  ```typescript
  const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
  if (res.ok) {
    setAgents(agents.filter(a => a.id !== id));
  }
  ```
- [ ] **P0.1.8** Add plan gating check at top of page:
  ```tsx
  if (!user?.plan_limits?.enabledAiAgents) {
    return <FeatureLockedBanner feature="AI Agents" />;
  }
  ```
- [ ] **P0.1.9** Test: Load page → verify agents fetched ✅
- [ ] **P0.1.10** Test: Delete agent → verify API called ✅
- [ ] **P0.1.11** Test: Check error handling (break endpoint) ✅

### Day 4-5: Build Analytics API (Task P0.2 - Part 1)

**Create:** `app/api/analytics/summary/route.ts`

- [ ] **P0.2.1** Create new file at `/api/analytics/summary/route.ts`
- [ ] **P0.2.2** Implement GET handler:
  ```typescript
  export async function GET(request: Request) {
    const supabase = await createServerClient();
    const workspace_id = getWorkspaceIdFromParams();
    
    // Count total messages
    const { count: totalMessages } = await supabase
      .from('inbox')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id);
    
    // Count conversions
    const { count: conversions } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .eq('status', 'sent');
    
    return NextResponse.json({
      totalMessages: totalMessages || 0,
      conversions: conversions || 0,
      conversionRate: totalMessages ? (conversions / totalMessages) * 100 : 0,
      avgResponseTime: 1.2 // TODO: calculate from message timestamps
    });
  }
  ```
- [ ] **P0.2.3** Test endpoint returns valid JSON ✅
- [ ] **P0.2.4** Test workspace scoping (verify RLS) ✅

### Day 5-6: Update Analytics Page (Task P0.2 - Part 2)

**File:** `app/dashboard/analytics/page.tsx`

- [ ] **P0.2.5** Remove `mockAnalytics.getStats()` call
- [ ] **P0.2.6** Replace with live API call:
  ```tsx
  const loadAnalytics = async () => {
    const res = await fetch('/api/analytics/summary');
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  };
  ```
- [ ] **P0.2.7** Add date range parameter (optional for P0):
  ```tsx
  const [period, setPeriod] = useState('30d');
  fetch(`/api/analytics/summary?period=${period}`)
  ```
- [ ] **P0.2.8** Add plan gating:
  ```tsx
  if (user?.plan_type === 'starter') {
    return <FeatureLockedBanner feature="Analytics" />;
  }
  ```
- [ ] **P0.2.9** Test: Load page → verify real data shows ✅
- [ ] **P0.2.10** Test: Change period filter (if implemented) ✅

### Day 7: Fix Dashboard Metrics (Task P0.3)

**File:** `app/dashboard/page.tsx`

- [ ] **P0.3.1** Create `getConnectedPagesCount()`:
  ```typescript
  const pagesRes = await fetch('/api/meta/pages');
  const pagesData = pagesRes.ok ? await pagesRes.json() : { pages: [] };
  const pageCount = pagesData.pages?.length || 0;
  ```
- [ ] **P0.3.2** Create `getAiUsageCount()` (stub if endpoint not ready):
  ```typescript
  const usageRes = await fetch('/api/ai/usage?period=month');
  const usageData = usageRes.ok ? await usageRes.json() : { count: 0 };
  const usageCount = usageData.count || 0;
  ```
- [ ] **P0.3.3** Update `setCounts()` to use fetched values:
  ```tsx
  setCounts({
    inbox: inboxData.conversations?.length || 0,
    rules: rulesData.length || 0,
    pages: pageCount,      // ← Was 0
    aiUsage: usageCount,   // ← Was 0
  });
  ```
- [ ] **P0.3.4** Add workspace ID to inbox fetch:
  ```typescript
  const inboxRes = await fetch(`/api/inbox?workspaceId=${user.id}`);
  ```
- [ ] **P0.3.5** Add workspace ID to rules fetch:
  ```typescript
  const rulesRes = await fetch(`/api/automation-rules?workspace_id=${user.id}`);
  ```
- [ ] **P0.3.6** Test: Dashboard loads → all 4 metrics show real numbers ✅
- [ ] **P0.3.7** Test: Metrics update when data changes ✅

---

## WEEK 2: HIGH PRIORITY (P1 Tasks)

### Day 8-9: Feature Gating (Task P1.1)

**Files affected:** Multiple dashboard pages

For each page listed below, add feature check at top:

- [ ] **P1.1.1** `analytics/page.tsx` - Gate to Pro+ plans
  ```tsx
  if (!['pro', 'advanced', 'enterprise'].includes(user?.plan_type)) {
    return <FeatureLockedBanner feature="Analytics" requiredPlan="Pro" />;
  }
  ```

- [ ] **P1.1.2** `agents/page.tsx` - Already added in P0.1.8 ✅

- [ ] **P1.1.3** `integrations/page.tsx` - Enforce max pages
  ```tsx
  if (connectedPages.length >= user?.plan_limits?.maxPages) {
    return <FeatureLockedBanner message="Max pages reached for your plan" />;
  }
  ```

- [ ] **P1.1.4** `inbox/page.tsx` - Add to page header (optional):
  ```tsx
  if (!['pro', 'advanced', 'enterprise'].includes(user?.plan_type)) {
    return <LimitedAccessBanner>Comment-to-DM limited</LimitedAccessBanner>;
  }
  ```

- [ ] **P1.1.5** Check all feature gates match actual limits in `PLAN_LIMITS` constant
- [ ] **P1.1.6** Test each page with different plan types ✅
- [ ] **P1.1.7** Test that upgrade CTA works ✅

### Day 10-11: Pagination (Task P1.2)

**Files affected:** `components/inbox/ConversationsList.tsx`, `dashboard/agents/page.tsx`

For ConversationsList:

- [ ] **P1.2.1** Add pagination state:
  ```tsx
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  ```

- [ ] **P1.2.2** Update fetch URL:
  ```typescript
  const res = await fetch(
    `/api/inbox?workspaceId=${workspaceId}&page=${page}&limit=${limit}`
  );
  ```

- [ ] **P1.2.3** Store total from response:
  ```tsx
  const data = await res.json();
  setTotal(data.total);
  setConversations(data.data);
  ```

- [ ] **P1.2.4** Add pagination controls UI:
  ```tsx
  <PaginationControls
    page={page}
    pageSize={limit}
    total={total}
    onPageChange={setPage}
  />
  ```

For Agents page:

- [ ] **P1.2.5** Repeat steps P1.2.1-P1.2.4 for agents list

- [ ] **P1.2.6** Test: Load list → shows first 20 items ✅
- [ ] **P1.2.7** Test: Click next page → loads next 20 ✅
- [ ] **P1.2.8** Test: Total count correct ✅

### Day 12: Workspace Scoping (Task P1.3)

**Verification Task** - Ensure all APIs are workspace-scoped

- [ ] **P1.3.1** Verify `/api/agents` filters by `workspace_id` ✅
- [ ] **P1.3.2** Verify `/api/inbox` filters by `workspace_id` ✅
- [ ] **P1.3.3** Verify `/api/automation-rules` filters by `workspace_id` ✅
- [ ] **P1.3.4** Verify `/api/settings` filters by `workspace_id` ✅
- [ ] **P1.3.5** Verify all dashboard pages pass `workspace_id` to APIs ✅
- [ ] **P1.3.6** Audit RLS policies ensure they check workspace membership ✅
- [ ] **P1.3.7** Test: Create user A & user B → verify data isolation ✅

---

## WEEK 3: MEDIUM PRIORITY (P2 Tasks)

### Day 13-14: Usage Tracking (Task P2.1)

**Create:** `app/api/ai/usage/route.ts`

- [ ] **P2.1.1** Create endpoint:
  ```typescript
  export async function GET(request: Request) {
    const period = searchParams.get('period') || 'month';
    const workspace_id = getWorkspaceId();
    
    const { count } = await supabase
      .from('message_logs')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .gte('created_at', getDateRange(period));
    
    return NextResponse.json({ count });
  }
  ```

- [ ] **P2.1.2** Update dashboard to use this endpoint
- [ ] **P2.1.3** Track comment-to-DM usage in inbox reply handler
- [ ] **P2.1.4** Show usage meter in settings page
- [ ] **P2.1.5** Show warning at 80% usage
- [ ] **P2.1.6** Block new replies at 100% usage
- [ ] **P2.1.7** Test: Usage counter increments ✅
- [ ] **P2.1.8** Test: Warning shows at threshold ✅
- [ ] **P2.1.9** Test: Blocking works at limit ✅

### Day 15-16: Plan Management UI (Task P2.2)

**Create:** `/api/plans/route.ts`, Update: `dashboard/billing/page.tsx`

- [ ] **P2.2.1** Create `/api/plans` endpoint:
  ```typescript
  export async function GET() {
    const { data: plans } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    
    return NextResponse.json({ plans });
  }
  ```

- [ ] **P2.2.2** Update billing page to fetch plans:
  ```tsx
  const res = await fetch('/api/plans');
  const { plans } = await res.json();
  setPlans(plans);
  ```

- [ ] **P2.2.3** Build plan comparison grid component
- [ ] **P2.2.4** Highlight current plan
- [ ] **P2.2.5** Add upgrade button for each plan
- [ ] **P2.2.6** Create `/api/billing/upgrade` endpoint
- [ ] **P2.2.7** Implement upgrade flow (redirect to checkout)
- [ ] **P2.2.8** Add pause subscription button
- [ ] **P2.2.9** Add cancel subscription button
- [ ] **P2.2.10** Show invoice history
- [ ] **P2.2.11** Test: Plans load ✅
- [ ] **P2.2.12** Test: Upgrade button works ✅
- [ ] **P2.2.13** Test: Pause/cancel options work ✅

### Day 17-18: Automation Rules UI (Task P2.3)

**Update:** `app/dashboard/inbox-automation/page.tsx`

- [ ] **P2.3.1** Replace hardcoded empty state with API call
- [ ] **P2.3.2** Fetch rules from `/api/automation-rules`
- [ ] **P2.3.3** Display rules in list/table format
- [ ] **P2.3.4** Add edit button for each rule
- [ ] **P2.3.5** Create edit page (`[id]/page.tsx`)
- [ ] **P2.3.6** Add test/preview button
- [ ] **P2.3.7** Add enable/disable toggle
- [ ] **P2.3.8** Test: Rules list shows data ✅
- [ ] **P2.3.9** Test: Edit button works ✅
- [ ] **P2.3.10** Test: Test button previews rule ✅

---

## QUALITY ASSURANCE CHECKLIST

### Code Quality

- [ ] No hardcoded mock data in production code
- [ ] All API errors caught and displayed
- [ ] All async operations have loading states
- [ ] No console.errors in production builds
- [ ] All fetch calls include workspace_id parameter
- [ ] All API endpoints verify workspace membership

### Testing

- [ ] Manual test: Load each dashboard page ✅
- [ ] Manual test: All API calls succeed ✅
- [ ] Manual test: Error states trigger correctly ✅
- [ ] Manual test: Loading states show/hide ✅
- [ ] Manual test: Navigation between pages works ✅
- [ ] Manual test: Feature gates work with different plans ✅
- [ ] Unit test: Analytics aggregation queries ✅
- [ ] Integration test: Multi-user workspace isolation ✅

### Accessibility

- [ ] All form inputs have labels
- [ ] All buttons have descriptive text
- [ ] Loading spinners have aria-labels
- [ ] Error messages are clear and actionable
- [ ] Color not used as only indicator
- [ ] Keyboard navigation works throughout

### Performance

- [ ] List pagination implemented (no 1000+ item renders)
- [ ] Analytics caching implemented (1 hour TTL)
- [ ] Images optimized/lazy loaded
- [ ] Bundle size reasonable
- [ ] Page load time < 2s
- [ ] API response time < 1s

### Security

- [ ] No auth changes to `/api/auth/` ✅ (frozen)
- [ ] All API endpoints verify session
- [ ] RLS policies enforce workspace boundaries
- [ ] No PII exposed in console logs
- [ ] No credentials in frontend code
- [ ] CORS headers correct

---

## SIGN-OFF CHECKLIST

### Before Merging to Main

- [ ] All P0 tasks completed
- [ ] All P1 tasks completed
- [ ] No regressions in existing features
- [ ] Auth freeze boundaries maintained
- [ ] Code reviewed by team lead
- [ ] QA testing passed
- [ ] Deployment plan documented
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured
- [ ] Database backups current

### Before Deploying to Production

- [ ] Staging deploy successful
- [ ] Smoke tests pass
- [ ] Performance benchmarks acceptable
- [ ] Security audit pass
- [ ] Customer comms ready
- [ ] Support team briefed
- [ ] Runbook updated
- [ ] Incident response plan ready

---

## PROGRESS TRACKING

Use this section to mark completion:

```
WEEK 1 CRITICAL PATH
[████████░░] 80% Complete (P0.1, P0.2 done; P0.3, B1 in progress)

WEEK 2 HIGH PRIORITY
[░░░░░░░░░░]  0% Complete (Not started)

WEEK 3 MEDIUM PRIORITY
[░░░░░░░░░░]  0% Complete (Not started)

OVERALL
[██░░░░░░░░] 20% Complete
```

---

## RESOURCE LINKS

- **Full Analysis:** [DASHBOARD_ANALYSIS_PHASE1.md](DASHBOARD_ANALYSIS_PHASE1.md)
- **Component Status:** [DASHBOARD_COMPONENT_INVENTORY.md](DASHBOARD_COMPONENT_INVENTORY.md)
- **Quick Summary:** [DASHBOARD_ANALYSIS_QUICK_SUMMARY.md](DASHBOARD_ANALYSIS_QUICK_SUMMARY.md)
- **Database Schema:** `supabase/migrations/002_complete_schema.sql`
- **API Route Examples:** `app/api/agents/route.ts`, `app/api/inbox/route.ts`

---

**Checklist Version:** 1.0  
**Last Updated:** January 12, 2026  
**Status:** Ready for Implementation

