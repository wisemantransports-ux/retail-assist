# Retail Pro - Facebook/Instagram Automation Bot

## Overview
AI-powered social media automation tool for businesses to auto-reply to Facebook & Instagram comments and messages, manage conversations, and increase sales. Designed for African SMBs.

**White-Label Ready**: This app is prepared for export/resale with customizable branding.

## Current State
- **Status**: Production-ready with subscription system (White-Label Ready)
- **Database**: File-based JSON Storage (`.data/` directory)
- **Authentication**: Session-based password authentication
- **Billing**: PayPal subscription links (manual verification by admin)
- **Branding**: Fully customizable via `/admin/branding` page

## Subscription Plans

| Plan | Price | Pages | Instagram | Comment-to-DM |
|------|-------|-------|-----------|---------------|
| Starter | $22/mo | 1 | No | 100/month |
| Pro | $45/mo | 3 | Yes | 500/month |
| Enterprise | $75/mo | Unlimited | Yes | Unlimited |

## Key Features

### Core Automation
- Facebook Messenger auto-reply
- Instagram DM automation (Pro+)
- Comment-to-Inbox (auto-DM when someone comments)
- AI-powered responses
- Multi-tenant support

### Subscription System
- `payment_status`: unpaid | paid
- `subscription_status`: pending | awaiting_approval | active | suspended
- `plan_type`: starter | pro | enterprise
- `billing_start_date` / `billing_end_date` / `activated_at`
- `paypal_subscription_id` for payment tracking

### Admin Dashboard
- `/admin` - Dashboard with user stats & revenue
- `/admin/login` - Admin login
- `/admin/logs` - System logs
- `/admin/settings` - Admin settings
- `/admin/users/[id]` - Edit user subscription

### Access Control
- Unpaid users see payment-required page with PayPal links
- Awaiting approval users see waiting message after confirming payment
- Active users get full dashboard access
- Suspended users see reactivation message
- Features locked based on plan limits

## Project Structure
```
app/
├── admin/              # Admin dashboard pages
├── api/
│   ├── admin/          # Admin API endpoints
│   ├── auth/           # Authentication endpoints
│   └── webhooks/       # Facebook/Instagram webhooks
├── auth/               # Auth pages (login, signup)
├── components/
│   └── SubscriptionGuard.tsx  # Access control
├── dashboard/          # User dashboard (protected)
├── lib/
│   └── replit-db/      # Database with PLAN_LIMITS
├── pricing/            # Pricing page
└── marketing/          # Marketing pages

.data/                  # JSON database storage (gitignored)
```

## Database Schema
```typescript
interface User {
  id: string;
  email: string;
  password_hash: string;
  business_name: string;
  phone: string;
  plan_type: 'starter' | 'pro' | 'enterprise';
  payment_status: 'unpaid' | 'paid';
  subscription_status: 'pending' | 'awaiting_approval' | 'active' | 'suspended';
  billing_start_date?: string;
  billing_end_date?: string;
  activated_at?: string;
  paypal_subscription_id?: string;
  role: 'user' | 'admin';
}
```

## Environment Variables
```
# Admin Credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
PASSWORD_SALT=your-secret-salt

# White-Label (Optional)
LICENSE_KEY=your-license-key
DATA_DIR=./.data

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET_KEY=

# Meta (Facebook/Instagram)
META_VERIFY_TOKEN=
META_PAGE_ACCESS_TOKEN=
META_APP_ID=
META_APP_SECRET=

# AI
OPENAI_API_KEY=
```

## Admin Workflow (Pay-Before-Approval Flow)
1. User signs up, selects plan → payment_status = unpaid, subscription_status = pending
2. User goes to /checkout and clicks "Subscribe with PayPal"
3. Browser redirects directly to PayPal subscription URL (no API calls)
4. User completes payment on PayPal → Can go to /billing/success
5. User status remains pending until admin manually activates
6. Admin sees user in dashboard, verifies PayPal payment
7. Admin clicks "Approve" → subscription_status = active, activated_at = now
8. User can now access dashboard features

## Default Admin Credentials
- Email: admin@example.com
- Password: admin123
- **Change immediately after first login!**

## Recent Changes
- **Simplified PayPal Direct Redirect** (Dec 2024): No API, no SDK
  - `/checkout` page - Direct `window.location.href` redirect to PayPal subscription URLs
  - `/billing/success` - Post-payment success page with admin approval message
  - `/dashboard/billing/payment-required` - Direct PayPal redirect button
  - PayPal Plan IDs hardcoded in frontend:
    - Starter: P-5UR06154M6627520CNE64LUY ($22/month)
    - Pro: P-1UV77920V62315442NE64TUQ ($45/month)
    - Enterprise: P-1AS84342BJ038470VNE64XHI ($75/month)
  - Flow: User clicks subscribe → Direct redirect to PayPal → Manual admin activation
- **Pay-Before-Approval Flow**: Users must pay before admin approval
  - Added payment_status (unpaid/paid) field to users
  - Added awaiting_approval subscription status
  - Created /dashboard/billing/payment-required page
  - Created /api/billing/confirm-payment endpoint
  - Updated SubscriptionGuard for new flow
  - Admin dashboard shows Payment column and Approve button
- Migrated from BWP to USD pricing ($22/$45/$75)
- Changed plan names: starter, pro, enterprise
- Added subscription_status, billing dates, paypal_subscription_id
- Created SubscriptionGuard for dashboard access control
- Enhanced admin dashboard with subscription management
- Added feature limits enforcement based on plan
- Implemented real Meta OAuth flow (app/api/meta/*)
- Created AI response generation (app/lib/ai.ts) using OpenAI
- Updated facebook.ts with real Graph API calls
- Added AI-powered auto-replies in webhook handler

## Meta Integration

### OAuth Flow
1. User clicks "Connect Facebook" on /dashboard/integrations
2. Redirects to Facebook OAuth (app/api/meta/oauth)
3. Callback exchanges code for token (app/api/meta/callback)
4. User selects pages to connect (app/api/meta/pages)
5. Page tokens stored in database

### Webhook Handler
- Endpoint: /api/webhooks/facebook
- Handles: Comments, DMs
- AI-powered responses when enabled in settings
- Comment-to-DM automation

### Key Files
- `app/lib/facebook.ts` - Graph API functions
- `app/lib/ai.ts` - OpenAI integration
- `app/api/meta/*` - OAuth endpoints
- `app/api/webhooks/facebook/route.ts` - Webhook handler

## White-Label Export

### Key Files for Customization
- `/app/config/branding.ts` - Server-side branding config
- `/app/config/branding.client.ts` - Client-side branding utilities
- `/app/api/branding/route.ts` - API for getting/updating branding
- `/app/admin/branding/page.tsx` - Admin UI to customize branding
- `/app/lib/license.ts` - License key validation
- `/app/components/LicenseCheck.tsx` - Unlicensed warning banner

### Branding Configuration
All branding is stored in `.data/branding.json` and can be customized via:
1. Admin Panel: `/admin/branding`
2. Direct JSON editing: `.data/branding.json`

PayPal brand name is automatically sourced from the branding config.

### License Protection
- Set `LICENSE_KEY` environment variable to activate license
- Without license key, shows "Unlicensed installation" banner (doesn't block admin)
- License check happens on page load

### Data Storage
- All data stored in `.data/` directory (file-based JSON)
- Set `DATA_DIR` env var to customize location
- No external database dependencies
