# Employee Access - Remaining Work & Next Steps

**Status**: Implementation Complete → Ready for Next Phase
**Date**: January 16, 2026

---

## Completed ✅

### Database Layer
- [x] Migration 030: Employee tables
- [x] Migration 031: Super admin
- [x] Migration 032: Invite creation with authorization
- [x] Migration 033: Invite acceptance with validation
- [x] Migration 034: Workspace normalization
- [x] Migration 035: Constraints & RLS policies

### RPC Functions
- [x] Migration 029: rpc_get_user_access (verified)
- [x] Migration 032: rpc_create_employee_invite (authorization checks)
- [x] Migration 033: rpc_accept_employee_invite (single-workspace enforcement)

### Middleware
- [x] Employee role handling in middleware.ts
- [x] Route validation and redirects
- [x] Workspace delegation comments

### Documentation
- [x] EMPLOYEE_ACCESS_SUMMARY.md (quick reference)
- [x] EMPLOYEE_ACCESS_IMPLEMENTATION.md (comprehensive guide)
- [x] EMPLOYEE_ACCESS_TESTING.md (15 test cases)
- [x] EMPLOYEE_ACCESS_DEPLOYMENT_GUIDE.md (deployment steps)
- [x] EMPLOYEE_ACCESS_README.md (overview)

**Total Completed**: 18 items ✅

---

## Remaining Work (Not in Scope)

### Phase 2: API Endpoint Implementation

#### Status: Not Started
#### Effort: ~3-4 hours
#### Priority: HIGH (required for employees to use system)

### Endpoints to Create

**1. GET /api/employees/dashboard/messages**
```typescript
Purpose: Get employee's assigned messages
Requires:
  - Authenticate user
  - Validate role === 'employee'
  - Get workspace_id from RPC
  - Query messages WHERE workspace_id = employee_ws
Returns: Array of message objects
Scoping: Filtered by workspace_id + assigned_to employee_id
```

**2. GET /api/employees/dashboard/messages/{id}**
```typescript
Purpose: Get single message details
Requires:
  - Authenticate user
  - Validate message belongs to employee's workspace
  - Validate message assigned to employee
Returns: Single message object with full details
Error: 403 if workspace mismatch, 404 if not found
```

**3. POST /api/employees/dashboard/messages/{id}**
```typescript
Purpose: Update message status, add notes, etc.
Requires:
  - Authenticate user
  - Validate message belongs to employee
  - Validate workspace_id matches
  - Validate update action allowed for role
Returns: Updated message object
Error: 403 if workspace mismatch, 400 if invalid state
```

**4. GET /api/employees/dashboard/metrics**
```typescript
Purpose: Get dashboard metrics
Requires:
  - Authenticate user
  - Validate role === 'employee'
  - Get workspace_id from RPC
Returns: { assigned_count, in_progress_count, completed_count }
Scoping: Aggregated by workspace_id + employee_id
```

**5. GET /api/employees/dashboard/profile**
```typescript
Purpose: Get employee profile
Requires:
  - Authenticate user
  - Validate role === 'employee'
Returns: Employee record with name, email, phone, workspace_id
```

**6. POST /api/auth/invite/accept**
```typescript
Purpose: Accept employee invite
Requires:
  - Token from URL parameter
  - Full name, phone, password from form
  - No authentication required (open endpoint)
Calls: rpc_accept_employee_invite()
Returns: Success message + redirect to login
Error: 400 if invalid token, already accepted, user already employee
```

### Pattern for All Endpoints

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // 1️⃣ Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // 2️⃣ Get role + workspace from RPC
  const { data: roleData, error: roleError } = await supabase
    .rpc('rpc_get_user_access')
    .single();
  if (roleError || !roleData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { role, workspace_id } = roleData;
  
  // 3️⃣ Validate: Is employee?
  if (role !== 'employee') {
    return NextResponse.json({ error: 'Employees only' }, { status: 403 });
  }
  
  // 4️⃣ Validate: workspace_id exists
  if (!workspace_id) {
    return NextResponse.json({ error: 'Invalid employee state' }, { status: 403 });
  }
  
  // 5️⃣ Validate: Request workspace matches employee's workspace (if applicable)
  const requestWs = request.nextUrl.searchParams.get('workspace_id');
  if (requestWs && requestWs !== workspace_id) {
    return NextResponse.json({ error: 'Cannot access this workspace' }, { status: 403 });
  }
  
  // 6️⃣ Query with workspace filter
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('created_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // 7️⃣ Return data
  return NextResponse.json(data);
}
```

### Estimated Effort per Endpoint
- GET endpoints: 30-45 min each (straightforward queries)
- POST endpoints: 45-60 min each (validation + state management)
- Total: ~3-4 hours

---

### Phase 3: Frontend Page Implementation

#### Status: Not Started
#### Effort: ~4-6 hours
#### Priority: HIGH (UI for employees)

### Pages to Create

**1. /employees/dashboard (main layout)**
```typescript
Purpose: Employee dashboard home page
Layout:
  - Header with employee name + workspace
  - Navigation (Messages, Metrics, Profile)
  - Quick stats (assigned, in_progress, completed)
  - Recent messages list
Requires:
  - GET /api/employees/dashboard/metrics (stats)
  - GET /api/employees/dashboard/messages (recent)
  - Employee profile context
```

**2. /employees/dashboard/messages (message list)**
```typescript
Purpose: View all assigned messages
Display:
  - Table/list of messages
  - Columns: sender, channel, status, created_at, actions
  - Filter by status (new, in_progress, completed)
  - Sort by date, sender, status
  - Click to view details
Requires:
  - GET /api/employees/dashboard/messages
  - Pagination if many messages
  - Real-time updates optional
```

**3. /employees/dashboard/messages/{id} (message detail)**
```typescript
Purpose: View and manage single message
Display:
  - Message content from customer
  - Assignment status
  - Notes section
  - AI response (if any)
  - Update status buttons (assign, in_progress, complete, escalate)
Actions:
  - Update status
  - Add notes
  - Escalate to admin
Requires:
  - GET /api/employees/dashboard/messages/{id}
  - POST /api/employees/dashboard/messages/{id}
  - Real-time updates optional
```

**4. /employees/dashboard/profile (employee profile)**
```typescript
Purpose: View/edit employee profile
Display:
  - Name (read-only)
  - Email (read-only)
  - Phone (editable)
  - Workspace (read-only)
  - Password change
Actions:
  - Update phone
  - Change password
  - Logout
Requires:
  - GET /api/employees/dashboard/profile
  - POST /api/auth/change-password
  - POST /api/employees/dashboard/profile (update)
```

**5. /invite?token={token} (invite acceptance)**
```typescript
Purpose: Accept employee invite
Layout:
  - Welcome message
  - Workspace name display
  - Form: Full name, phone, password
  - Accept button
Actions:
  1. User clicks email link with token
  2. Loads /invite?token=<token>
  3. Fills form
  4. Clicks Accept
  5. Calls POST /api/auth/invite/accept
  6. Redirects to /login
  7. User logs in with new account
Requires:
  - POST /api/auth/invite/accept
  - Form validation
  - Success/error messages
```

### Estimated Effort per Page
- Landing pages: 1 hour each (layout + simple queries)
- Detail pages: 1.5 hours each (forms + state management)
- Total: ~4-6 hours

---

### Phase 4: Testing Implementation

#### Status: Test Cases Written, Tests Not Yet Created
#### Effort: ~2-3 hours
#### Priority: MEDIUM (before deployment)

### Tests to Create

**1. Unit Tests**
```typescript
describe('RPC Functions', () => {
  test('rpc_get_user_access returns employee role + workspace', () => {
    // Create test employee
    // Call RPC
    // Assert returns: { user_id, workspace_id: 'xyz', role: 'employee' }
  });
  
  test('rpc_create_employee_invite validates authorization', () => {
    // Create test admin
    // Try to invite to own workspace (should succeed)
    // Try to invite to other workspace (should fail)
    // Try as employee (should fail)
  });
  
  test('rpc_accept_employee_invite enforces single workspace', () => {
    // Create invite
    // Accept invite (should succeed)
    // Accept another invite (should fail)
  });
});
```

**2. Integration Tests**
```typescript
describe('Employee Login Flow', () => {
  test('Employee login redirects to /employees/dashboard', () => {
    // POST /login with employee credentials
    // Assert redirects to /employees/dashboard
    // Assert role is 'employee'
    // Assert workspace_id is set
  });
});

describe('Invite Acceptance Flow', () => {
  test('Admin can invite employee to own workspace', () => {
    // Admin creates invite via API
    // Employee accepts invite via token
    // Employee can now login
    // Employee has workspace_id set
  });
});

describe('Cross-Workspace Prevention', () => {
  test('Employee cannot access another workspace', () => {
    // Create employee in workspace A
    // Try to GET /api/employees/dashboard/messages?workspace_id=B
    // Assert returns 403 Forbidden
    // Assert not 404 (important!)
  });
});
```

**3. End-to-End Tests (optional)**
```typescript
describe('Complete Employee Journey', () => {
  test('From invite to first message', () => {
    // Admin creates invite
    // Employee receives email
    // Employee clicks link
    // Employee fills signup form
    // Employee accepts invite
    // Employee logs in
    // Employee sees messages in their workspace
    // Employee can update message status
  });
});
```

### Test Files to Create
- `__tests__/rpc_functions.test.ts` (RPC tests)
- `__tests__/api_endpoints.test.ts` (API tests)
- `__tests__/middleware.test.ts` (Middleware tests)
- `__tests__/invite_flow.test.ts` (Full flow tests)

### Estimated Effort
- Unit tests: 45 min (straightforward)
- Integration tests: 1 hour (setup + assertions)
- E2E tests: 45 min (optional, browser automation)
- Total: ~2-3 hours

---

### Phase 5: Email Service Integration

#### Status: Not Started
#### Effort: ~1-2 hours
#### Priority: MEDIUM (required for invites)

### Required Implementation

**1. Email Template for Invites**
```html
Subject: You've been invited to Retail Assist

Hi,

[Admin Name] has invited you to join their workspace at Retail Assist.

Click here to accept the invite:
https://app.com/invite?token=<secure-token>

This invite expires in 30 days.

Questions? Contact [Admin Email]

Thanks,
Retail Assist Team
```

**2. Email Sending Service**
```typescript
// app/api/emails/send-invite.ts

export async function POST(request: Request) {
  const body = await request.json();
  const { email, token, adminName, workspaceName } = body;
  
  // Send email via:
  // - SendGrid
  // - Resend (Vercel's email service)
  // - Mailgun
  // - AWS SES
  // etc.
  
  return { success: true };
}
```

**3. Integration Points**
- Call from invite creation endpoint
- Call from admin dashboard invite button
- Include workspace name
- Include admin name
- Include secure token in URL

### Estimated Effort
- Email template: 15 min
- Email service setup: 30 min
- Integration: 30 min
- Testing: 30 min
- Total: ~1-2 hours

---

### Phase 6: Optional Enhancements

#### Status: Not Started
#### Effort: Variable
#### Priority: LOW (nice-to-have)

### Possible Enhancements

**1. Real-Time Updates**
- WebSocket connection for live message updates
- Employee dashboard shows new messages instantly
- Status changes update in real-time

**2. Notification System**
- Email when assigned new message
- Browser notification for new messages
- Notification preferences

**3. Advanced Filtering**
- Filter messages by status, channel, date
- Search messages by content
- Custom views/dashboards

**4. Escalation Workflow**
- Easy escalation to admin
- Escalation notes
- Admin acknowledgment

**5. Analytics**
- Response time metrics
- Resolution rate
- Employee performance dashboard

**6. Audit Trail**
- Log all message status changes
- Log all employee actions
- Admin can review history

---

## Recommended Implementation Order

### Week 1: Core Functionality
- [ ] Day 1: API endpoints (GET, POST)
- [ ] Day 2: Frontend pages (basic layout)
- [ ] Day 3: Integration testing
- [ ] Day 4: Bug fixes & polish
- [ ] Day 5: Deployment & monitoring

### Week 2: Enhancement
- [ ] Email integration
- [ ] Advanced features (filtering, search)
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation updates

### Week 3+: Optional
- [ ] Real-time updates
- [ ] Notifications
- [ ] Analytics
- [ ] Escalation workflow

---

## Current Blockers: None ✅

All infrastructure in place:
- Database migrations: ✅ Complete
- RPC functions: ✅ Complete
- Middleware: ✅ Complete
- Documentation: ✅ Complete

Ready to proceed with API implementation.

---

## Dependencies & Prerequisites

### Required
- [x] Supabase project set up
- [x] Database migrations applied
- [x] RPC functions created
- [x] Middleware updated
- [ ] Environment variables configured
- [ ] Email service set up (for invite sending)

### Optional
- [ ] Analytics service (Segment, Mixpanel)
- [ ] Error tracking (Sentry)
- [ ] Monitoring (DataDog, New Relic)

---

## Success Criteria

### Phase 2 (API) Complete When:
- [ ] All 6 endpoints implemented
- [ ] All endpoints validated
- [ ] All test cases passing
- [ ] Workspace scoping verified
- [ ] No data leakage between workspaces

### Phase 3 (Frontend) Complete When:
- [ ] All 5 pages created
- [ ] Pages render correctly
- [ ] Links between pages working
- [ ] Forms submit correctly
- [ ] Error handling in place

### Phase 4 (Testing) Complete When:
- [ ] Unit tests pass (100%)
- [ ] Integration tests pass (100%)
- [ ] E2E tests pass (100%)
- [ ] Security tests pass (100%)
- [ ] Cross-workspace tests fail as expected

### Phase 5 (Email) Complete When:
- [ ] Email service configured
- [ ] Invite emails sent correctly
- [ ] Links in emails work
- [ ] Token validation working
- [ ] Email templates reviewed

---

## Summary

| Phase | Status | Effort | Priority | Start |
|-------|--------|--------|----------|-------|
| 1: Infrastructure | ✅ Complete | Done | Critical | ✅ |
| 2: API Endpoints | ⏳ Pending | 3-4h | High | Next |
| 3: Frontend | ⏳ Pending | 4-6h | High | After #2 |
| 4: Testing | ⏳ Pending | 2-3h | Medium | Parallel |
| 5: Email | ⏳ Pending | 1-2h | Medium | After #2 |
| 6: Enhancements | ⏳ Pending | Var | Low | Later |

**Total Work Remaining**: ~12-18 hours (excluding enhancements)

---

**Document**: EMPLOYEE_ACCESS_NEXT_STEPS.md
**Version**: 1.0
**Created**: January 16, 2026
**Ready**: ✅ For API Implementation Phase
