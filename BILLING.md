# BILLING & PAYMENT GATEWAY INTEGRATION (Feature 10)

## Overview

Feature 10 implements a comprehensive billing and payment system supporting multiple payment methods:
- **PayPal**: Secure online payment processing
- **Mobile Money**: Manual verification workflow for MTN, Vodacom, Airtel (Botswana)

The system is workspace-scoped, allowing each workspace to manage its own subscriptions and billing independently.

---

## Architecture

### Database Schema

#### `plans` Table
Stores available subscription plans with pricing information.

```sql
plans {
  id UUID PRIMARY KEY
  name TEXT UNIQUE
  display_name TEXT
  description TEXT
  price_monthly NUMERIC(10,2)
  price_yearly NUMERIC(10,2)
  included_monthly_usage BIGINT
  included_features TEXT[]
  is_active BOOLEAN
  sort_order INT
}
```

#### `subscriptions` Table
Tracks active subscriptions per workspace.

```sql
subscriptions {
  id UUID PRIMARY KEY
  workspace_id UUID NOT NULL
  plan_id UUID NOT NULL
  status TEXT ('trial', 'active', 'past_due', 'cancelled', 'paused')
  billing_cycle TEXT ('monthly', 'yearly')
  renewal_date TIMESTAMP
  provider TEXT ('paypal', 'stripe', 'momo', 'manual')
  provider_subscription_id TEXT
  is_on_grace_period BOOLEAN
  grace_period_ends_at TIMESTAMP
  last_payment_date TIMESTAMP
}
```

#### `billing_payments` Table
Records all payment transactions.

```sql
billing_payments {
  id UUID PRIMARY KEY
  subscription_id UUID NOT NULL
  workspace_id UUID NOT NULL
  amount NUMERIC(10,2)
  currency TEXT
  provider TEXT ('paypal', 'stripe', 'momo', 'manual')
  status TEXT ('pending', 'completed', 'failed', 'refunded')
  transaction_id TEXT
  metadata JSONB
}
```

#### `momo_payments` Table
Tracks mobile money payments requiring manual confirmation.

```sql
momo_payments {
  id UUID PRIMARY KEY
  subscription_id UUID NOT NULL
  workspace_id UUID NOT NULL
  phone_number TEXT NOT NULL
  amount NUMERIC(10,2)
  reference_code TEXT UNIQUE
  provider TEXT ('mtn', 'vodacom', 'airtel')
  status TEXT ('pending', 'confirmed', 'rejected', 'expired')
  confirmed_by UUID
  confirmed_at TIMESTAMP
  expires_at TIMESTAMP
}
```

#### `billing_events` Table
Audit log for all billing-related events.

```sql
billing_events {
  id UUID PRIMARY KEY
  workspace_id UUID NOT NULL
  event_type TEXT
  subscription_id UUID
  payment_id UUID
  data JSONB
  created_at TIMESTAMP
}
```

### Core Libraries

#### `app/lib/paypal/billing.ts`
PayPal payment helper functions:
- `createPaymentOrder()` - Create one-time payment order
- `capturePayment()` - Capture approved order
- `verifyPayPalWebhook()` - Verify webhook signatures

#### `app/lib/mobile-money/billing.ts`
Mobile Money helper functions:
- `generateMobileMoneyReference()` - Generate unique reference code
- `validatePhoneNumber()` - Validate Botswana phone numbers
- `formatPhoneNumber()` - Normalize phone format
- `detectProvider()` - Auto-detect provider from phone number
- `sendPendingPaymentNotification()` - Send admin email (placeholder)

#### `app/lib/billing/core.ts`
Core billing logic:
- `activateSubscription()` - Activate new subscription
- `recordPaymentSuccess()` - Record successful payment
- `applyRenewalDates()` - Calculate next renewal date
- `handlePaymentFailure()` - Apply grace period
- `cancelSubscription()` - Cancel subscription
- `checkGracePeriodExpiry()` - Check expired grace periods
- `pauseSubscription()` / `resumeSubscription()` - Pause/resume
- `upgradeSubscription()` - Upgrade to higher plan

### API Routes

#### PayPal Checkout
**Endpoint**: `POST /api/billing/checkout/paypal`

Create a PayPal order for subscription.

**Request**:
```json
{
  "planId": "uuid",
  "billingCycle": "monthly" | "yearly",
  "workspaceId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "orderId": "string",
  "approvalUrl": "https://...",
  "planId": "uuid",
  "amount": "99.99",
  "billingCycle": "monthly"
}
```

#### PayPal Webhook
**Endpoint**: `POST /api/billing/paypal/webhook`

Handle PayPal events:
- `CHECKOUT.ORDER.COMPLETED` - Order approved
- `PAYMENT.CAPTURE.COMPLETED` - Payment captured
- `PAYMENT.CAPTURE.REFUNDED` - Refund processed
- `BILLING.SUBSCRIPTION.CANCELLED` - Subscription cancelled

#### Mobile Money Checkout
**Endpoint**: `POST /api/billing/checkout/momo`

Initiate mobile money payment with reference code.

**Request**:
```json
{
  "planId": "uuid",
  "phoneNumber": "267 71 123 456",
  "billingCycle": "monthly" | "yearly",
  "workspaceId": "uuid",
  "provider": "mtn" | "vodacom" | "airtel" (optional)
}
```

**Response**:
```json
{
  "success": true,
  "referenceCode": "MM-M-ABC123-XYZ789",
  "subscriptionId": "uuid",
  "paymentId": "uuid",
  "phoneNumber": "267 71 123 456",
  "provider": "mtn",
  "amount": 150,
  "currency": "BWP",
  "message": "Please send 150 BWP to your MTN account with reference: MM-M-ABC123-XYZ789"
}
```

#### Mobile Money Confirmation
**Endpoint**: `POST /api/billing/momo/confirm`

Admin endpoint to confirm payment and activate subscription.

**Request**:
```json
{
  "paymentId": "uuid",
  "notes": "Payment confirmed via SMS"
}
```

**Response**:
```json
{
  "success": true,
  "paymentId": "uuid",
  "status": "confirmed",
  "subscriptionActivated": true
}
```

---

## Environment Configuration

### Required Environment Variables

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret
PAYPAL_WEBHOOK_ID=your_webhook_id
PAYPAL_MODE=sandbox|live
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com

# Mobile Money Configuration
MOBILE_MONEY_SUPPORT_EMAIL=billing@retailassist.app

# Mock Mode
NEXT_PUBLIC_USE_MOCK_PAYMENTS=true|false
```

### Mock Mode

When `NEXT_PUBLIC_USE_MOCK_PAYMENTS=true`:
- All PayPal calls return simulated order IDs
- Webhook verification always passes
- Mobile money notifications are logged but not sent
- Useful for local development and testing

---

## Workflow

### PayPal Checkout Flow

1. User selects plan and billing cycle
2. Frontend calls `POST /api/billing/checkout/paypal`
3. Backend creates PayPal order and returns approval URL
4. User is redirected to PayPal for approval
5. After approval, user returns to app with `orderId` query param
6. Frontend calls `POST /api/billing/checkout/paypal/capture`
7. Payment is captured and subscription activated
8. PayPal sends webhook events for confirmation

### Mobile Money Flow

1. User selects plan and enters phone number
2. Frontend calls `POST /api/billing/checkout/momo`
3. Backend generates unique reference code and creates subscription (status: pending)
4. User receives reference code and sends payment via mobile money
5. Admin verifies payment receipt
6. Admin calls `POST /api/billing/momo/confirm` with payment ID
7. Subscription status changes to active
8. User can now access premium features

### Grace Period Handling

When payment fails:
1. `handlePaymentFailure()` is called
2. Subscription status set to `past_due`
3. Grace period enabled (7 days by default)
4. User can still access features during grace period
5. If payment not received by end of grace period, subscription cancelled
6. `checkGracePeriodExpiry()` should be called by cron job nightly

---

## Database Queries

### User-Facing Queries

```typescript
// Get workspace subscription
const { data: subscription } = await getWorkspaceSubscription(workspaceId);

// Get all active plans
const { data: plans } = await getAllPlans();

// Get payment history
const { data: payments } = await getBillingPaymentHistory(workspaceId);

// Get pending mobile money approvals (admin)
const { data: pending } = await getPendingMobileMoneyPayments(workspaceId);
```

### Admin Queries

```typescript
// Confirm mobile money payment
await confirmMobileMoneyPaymentBilling(paymentId, adminUserId, notes);

// Record billing event
await recordBillingEvent(workspaceId, 'payment_received', subscriptionId, paymentId);

// Cancel subscription
const { error } = await cancelSubscription(subscriptionId, workspaceId);
```

---

## UI Pages

### `/dashboard/[workspaceId]/billing`
Main billing page showing:
- Current plan and renewal date
- Available plans (if no subscription)
- Payment history table
- Pending mobile money approvals (admin)

### `/dashboard/[workspaceId]/billing/checkout`
Checkout page with:
- Plan selection
- Billing cycle toggle (monthly/yearly)
- Payment method selection (PayPal or Mobile Money)
- Mobile phone number input
- Order summary and total

---

## Testing

### Mock PayPal Payments

Set `NEXT_PUBLIC_USE_MOCK_PAYMENTS=true` in `.env.local`:

```bash
# All PayPal requests will be mocked
NEXT_PUBLIC_USE_MOCK_PAYMENTS=true
PAYPAL_CLIENT_ID=unused
PAYPAL_CLIENT_SECRET=unused
```

### Manual Mobile Money Testing

1. Select Mobile Money payment method
2. Enter test phone number (e.g., 267 71 123 456)
3. Receive reference code
4. Use admin endpoint to confirm:

```bash
curl -X POST http://localhost:5000/api/billing/momo/confirm \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{"paymentId": "uuid"}'
```

---

## Production Deployment

### PayPal Setup

1. Create PayPal developer account
2. Register your application
3. Generate Client ID and Secret
4. Create webhook endpoint
5. Configure webhook to receive all subscription and payment events
6. Set `PAYPAL_MODE=live` and update `PAYPAL_API_BASE`

### Mobile Money Integration

1. Implement actual email service (SendGrid, Mailgun, etc.)
2. Update `sendPendingPaymentNotification()` in `app/lib/mobile-money/billing.ts`
3. Set `MOBILE_MONEY_SUPPORT_EMAIL` to admin email

### Security Checklist

- [ ] Never expose `PAYPAL_CLIENT_SECRET` to client
- [ ] Verify all PayPal webhooks before processing
- [ ] Use HTTPS for all payment endpoints
- [ ] Implement rate limiting on checkout endpoints
- [ ] Log all billing events for audit
- [ ] Encrypt phone numbers in transit
- [ ] Review RLS policies for payment tables

---

## Future Enhancements

- Usage-based billing (count API calls, apply overage charges)
- Invoice generation and PDFs
- Billing portal (users manage payment methods)
- Stripe integration for additional payment options
- Usage analytics dashboard
- Dunning management (retry failed payments)
- Proration for mid-cycle upgrades
- Bulk payment exports
- Tax calculation per region

---

## Support & Troubleshooting

### Common Issues

**PayPal order creation fails**
- Check `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`
- Verify API base URL matches your mode (sandbox vs live)
- Check PayPal API for rate limits

**Mobile money confirmation not working**
- Verify user has admin/owner role in workspace
- Check payment ID exists and status is 'pending'
- Ensure subscription_id is linked correctly

**Webhook events not processing**
- Verify webhook URL is publicly accessible
- Check PayPal webhook ID matches `PAYPAL_WEBHOOK_ID`
- Review webhook logs in PayPal dashboard
- Ensure `verifyPayPalWebhook()` is passing for production

---

## Related Files

- Database migration: `supabase/migrations/001_initial_schema.sql`
- Types: `app/lib/types/database.ts`
- Queries: `app/lib/supabase/queries.ts`
- PayPal helpers: `app/lib/paypal/billing.ts`
- Mobile Money helpers: `app/lib/mobile-money/billing.ts`
- Core logic: `app/lib/billing/core.ts`
- API routes: `app/api/billing/**`
- UI pages: `app/dashboard/[workspaceId]/billing/**`
