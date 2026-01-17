# Instagram OAuth Integration - Developer Quick Reference

**Last Updated**: January 17, 2026  
**Status**: Production Ready  
**Version**: 1.0

---

## Quick Start

### For Frontend Developers

**Enable Instagram Connection**:
```tsx
// In app/dashboard/integrations/page.tsx
// Already integrated - just ensure user has Pro+ plan

// User clicks "Connect Instagram" button
// → handleConnectInstagram() triggers
// → Frontend validates plan with canUseInstagram(user)
// → Calls GET /api/meta/instagram/oauth
// → Receives authUrl
// → Redirects to Instagram.com
```

**Handle Callback**:
```tsx
// After user authorizes, Instagram redirects to callback
// Frontend receives: ?ig_success=true&ig_token=<base64>&ig_accounts=<count>

// Parse token:
const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
const accounts = tokenData.accounts; // Array of { id, name, username, access_token }

// Display account selection checkboxes
// User selects accounts
// POST to /api/meta/pages with { token, platform: 'instagram', selectedPageIds }
```

### For Backend Developers

**Instagram OAuth Flow**:
```
GET /api/meta/instagram/oauth
  ↓
[Validate session, subscription, plan]
  ↓
Generate Instagram OAuth URL with scopes
  ↓
Return { authUrl, scopes }
  ↓
User authorizes on Instagram.com
  ↓
GET /api/meta/instagram/callback?code=...&state=...
  ↓
[Validate CSRF state]
  ↓
Exchange code for access_token
  ↓
Fetch accounts from Graph API
  ↓
Create temp token, redirect with token
  ↓
POST /api/meta/pages with temp token
  ↓
[Enforce plan restrictions]
  ↓
Save to db.tokens with platform='instagram'
```

---

## API Endpoints

### 1. GET /api/meta/instagram/oauth

**Request**:
```
GET /api/meta/instagram/oauth
Cookie: session_id=...
```

**Response** (200):
```json
{
  "authUrl": "https://www.instagram.com/oauth/authorize?client_id=...&scope=instagram_basic,instagram_manage_messages&...",
  "scopes": ["instagram_basic", "instagram_manage_messages"]
}
```

**Error Responses**:
- 401: Session invalid
- 403: Subscription inactive or plan doesn't support Instagram

---

### 2. GET /api/meta/instagram/callback

**Query Parameters**:
- `code`: Authorization code from Instagram
- `state`: CSRF state (base64 encoded)
- `error`: Error code if denied
- `error_reason`: Error message

**Response** (Redirect):
```
/dashboard/integrations?ig_success=true&ig_token=<base64>&ig_accounts=2
```

**Temporary Token Format** (base64 decoded):
```json
{
  "userId": "user-uuid-123",
  "accounts": [
    {
      "id": "17841400393180093",
      "name": "My Business",
      "username": "my_business",
      "access_token": "IGAA...",
      "picture_url": "https://..."
    }
  ],
  "timestamp": 1705505400000
}
```

**Error Redirects**:
```
?error=auth_denied                    // User rejected
?error=missing_params                 // Missing code/state
?error=invalid_state                  // State validation failed
?error=token_exchange_failed          // Code exchange error
?error=pages_fetch_failed             // Account fetch error
?error=unexpected                     // Unhandled error
```

---

### 3. POST /api/meta/pages (Updated)

**Request for Instagram**:
```json
{
  "token": "base64-temp-token",
  "platform": "instagram",
  "selectedPageIds": ["17841400393180093", "18054322833187635"]
}
```

**Response** (200):
```json
{
  "success": true,
  "pages": [
    { "id": "17841400393180093", "name": "My Business" },
    { "id": "18054322833187635", "name": "Another Business" }
  ]
}
```

**Error Responses**:
```json
// Starter plan violation
{ "error": "Starter plan allows only one account. Upgrade to connect another." } // 403

// Token expired
{ "error": "Token expired. Please reconnect." } // 400

// Subscription inactive
{ "error": "Subscription not active" } // 403

// At plan limit
{ "error": "You can only add 0 more Instagram account(s) on your Pro plan" } // 403
```

---

## Plan Restrictions

### Starter Plan
```
✗ Cannot connect Instagram at all
✗ POST to /api/meta/instagram/oauth returns 403
✗ If 1 Facebook page connected, cannot add Instagram

Message: "Starter plan allows only one account. Upgrade to connect another."
```

### Pro Plan
```
✓ Can connect up to 3 Instagram accounts total (or mix with Facebook)
✓ Max 3 pages/accounts combined
```

### Enterprise Plan
```
✓ Can connect unlimited Instagram accounts
✓ No page limit
```

---

## Database Schema

**tokens table** - No changes needed:
```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  platform ENUM ('facebook', 'instagram'),  -- ← Already supports both
  page_id VARCHAR(255),                      -- Instagram account ID
  page_name VARCHAR(255),                    -- Account name or username
  access_token TEXT,                         -- Meta access token
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, page_id),
  INDEX(user_id),
  INDEX(page_id),
  INDEX(user_id, platform)
);
```

**Querying**:
```typescript
// Get all Instagram accounts for user
const igAccounts = tokens.filter(t => t.platform === 'instagram');

// Get all Facebook pages for user
const fbPages = tokens.filter(t => t.platform === 'facebook');

// Count total accounts (both platforms)
const total = tokens.length;

// Find specific account
db.tokens.findByPageId('17841400393180093');
```

---

## Feature Gating

**Function**: `canUseInstagram(user: UserData)`
```typescript
// Location: app/lib/feature-gates.ts

// Returns true if user's plan includes Instagram
// Requires: Pro plan or higher
// Checks: subscription_status === 'active' && payment_status === 'paid'

// Usage in frontend:
if (!canUseInstagram(user)) {
  // Show disabled button
  // Show "Pro plan required" badge
}
```

---

## Logging Examples

**Successful connection**:
```json
{
  "user_id": "user-123",
  "level": "info",
  "message": "Connected 2 Instagram account(s)",
  "meta": {
    "pageIds": ["17841400393180093", "18054322833187635"],
    "platform": "instagram"
  },
  "created_at": "2026-01-17T10:30:00Z"
}
```

**Plan violation**:
```json
{
  "user_id": "user-456",
  "level": "warn",
  "message": "Starter plan violation: Attempted to connect 2 Instagram accounts",
  "meta": {
    "plan": "starter",
    "platform": "instagram",
    "attemptedCount": 2,
    "existingCount": 0,
    "reason": "Starter plan allows only one account"
  },
  "created_at": "2026-01-17T10:35:00Z"
}
```

---

## Error Handling Patterns

### Frontend
```tsx
try {
  const res = await fetch('/api/meta/instagram/oauth');
  const data = await res.json();
  
  if (!res.ok) {
    // Handle error: data.error contains message
    setMessage({ type: 'error', text: data.error });
    return;
  }
  
  // Success: redirect to OAuth
  window.location.href = data.authUrl;
} catch (error: any) {
  setMessage({ type: 'error', text: error.message });
}
```

### Backend
```typescript
// All errors return JSON with status code and message
// Format: { error: "User-friendly message" }

return NextResponse.json(
  { error: 'Subscription not active' }, 
  { status: 403 }
);
```

---

## Environment Variables

Required in `.env.local`:
```env
# Meta App Credentials (existing)
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=your_verify_token

# Instagram-specific callback URI
META_REDIRECT_INSTAGRAM_URI=https://yourdomain.com/api/meta/instagram/callback

# Or use fallback to main app URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Testing Checklist

```bash
# Manual testing
[ ] Create Pro user
[ ] Click "Connect Instagram"
[ ] Redirect to Instagram login works
[ ] Can authorize app
[ ] Account selection shows accounts
[ ] Can select/deselect accounts
[ ] Save creates tokens in DB
[ ] Connected accounts display in UI
[ ] Disconnect works
[ ] Create Starter user
[ ] "Connect Instagram" button is disabled
[ ] Try to POST directly → 403 response
[ ] Log entry created for violation

# Automated testing
[ ] GET /api/meta/instagram/oauth validates session
[ ] GET /api/meta/instagram/oauth validates plan
[ ] GET /api/meta/instagram/callback validates CSRF state
[ ] POST /api/meta/pages platform=instagram works
[ ] POST /api/meta/pages enforces Starter limit
[ ] Webhook receives Instagram DM events
```

---

## Common Issues & Solutions

### Issue: "Pro plan required" shown but user is Pro

**Solution**: Check that `plan_limits.hasInstagram === true` in database
```sql
SELECT plan_type, plan_limits FROM users WHERE id = 'user-id';
-- Should show plan_type='pro' and hasInstagram: true in plan_limits
```

### Issue: Token expired error immediately

**Solution**: Verify server clock is accurate (10-minute window)
```bash
date  # Check system time
# If off, update with: sudo ntpdate -s time.nist.gov
```

### Issue: "Invalid state" on callback

**Solution**: Ensure state base64 decoding works
```typescript
// Test locally:
const state = Buffer.from('eyJ1c2VySWQiOiIxMjMiLCJ0aW1lc3RhbXAiOjE3MDU1MDU0MDB9', 'base64').toString();
console.log(state); // Should be valid JSON
```

### Issue: No Instagram accounts returned

**Solution**: Verify user has Instagram Business account linked to Facebook account
- Business account must be connected to Meta Business Suite
- May need to wait 24 hours after linking

---

## Meta Graph API Endpoints Used

```
# OAuth endpoints
POST https://graph.instagram.com/v19.0/oauth/access_token
GET https://www.instagram.com/oauth/authorize

# Account endpoints
GET https://graph.instagram.com/v19.0/{user_id}/accounts
  - Fields: id, name, username, profile_picture_url

# Message endpoints (in webhooks)
GET/POST https://graph.instagram.com/v19.0/{ig_account_id}/messages
```

---

## Migration from Merged OAuth

If upgrading from merged Facebook→Instagram OAuth:

**Current State**:
- Instagram only available through Facebook OAuth
- Cannot connect Instagram separately
- User must connect Facebook to get Instagram

**New State**:
- Instagram OAuth completely independent
- User can connect Instagram without Facebook
- Both can be connected side-by-side

**No database migration needed** - `platform` field already supports both

---

## Support & Debugging

### Enable Debug Logging
```typescript
// Add to endpoints:
console.log('[Instagram OAuth] Step name:', { context });
console.log('[Instagram Callback] Step name:', { context });
```

### Check Database
```sql
-- View all connected Instagram accounts
SELECT user_id, page_name, platform, created_at 
FROM tokens 
WHERE platform = 'instagram';

-- Check violations log
SELECT user_id, message, meta 
FROM logs 
WHERE message LIKE '%Starter plan violation%' 
  AND meta->>'platform' = 'instagram';
```

### Monitor Webhooks
```sql
-- Check Instagram webhook events (if logged)
SELECT * FROM logs 
WHERE message LIKE '%Instagram Webhook%' 
ORDER BY created_at DESC 
LIMIT 20;
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 17, 2026 | Initial release - Dedicated Instagram OAuth |

---

**Questions?** Check [INSTAGRAM_OAUTH_INTEGRATION_COMPLETE.md](INSTAGRAM_OAUTH_INTEGRATION_COMPLETE.md) for full documentation.

