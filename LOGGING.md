# Logging & Alerting System Documentation

## Overview

The logging and alerting system provides comprehensive monitoring across the entire application:

- **Centralized Logging**: All application logs written to `system_logs` table
- **Sentry Integration**: Real-time error tracking and performance monitoring (optional)
- **Email Alerts**: Critical events trigger immediate email notifications
- **Admin Dashboard**: `/app/admin/logs` for log viewing and filtering
- **Mock Mode Support**: Disable alerts and real webhook validation in test environments

---

## Architecture

### Database Schema

#### `system_logs` Table
Central logging table for all application events.

```sql
system_logs {
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  level TEXT ('debug', 'info', 'warning', 'error')
  workspace_id UUID REFERENCES workspaces(id) (nullable)
  user_id UUID REFERENCES users(id) (nullable)
  source TEXT ('api', 'webhook', 'background', 'ui')
  message TEXT
  metadata JSONB
  stack_trace TEXT (nullable)
}
```

**Indexes:**
- `level` (filter by severity)
- `timestamp` (sort and range queries)
- `workspace_id` (workspace-scoped queries)

**RLS Policies:**
- Admins can view logs for their workspace
- Service role can insert and read all logs

---

## Logger Utility

### Creating a Logger

```typescript
import { createLogger } from '@/lib/logging/logger';

const logger = createLogger('webhook', workspaceId, userId);

await logger.info('Webhook processed', { provider: 'stripe' });
await logger.warn('Rate limit approaching', { remaining: 10 });
await logger.error('Payment failed', new Error('Declined'), { orderId: '123' });
```

### Standalone Logger

```typescript
import { logger } from '@/lib/logging/logger';

await logger.info('Application started');
await logger.error('Critical error', error, { context: 'startup' });
```

### Helper Functions

#### logWebhookEvent

```typescript
import { logWebhookEvent } from '@/lib/logging/logger';

await logWebhookEvent('stripe', 'invoice.payment_succeeded', workspaceId, true, {
  invoiceId: 'in_123',
  amount: 2900,
});
```

#### logApiRoute

```typescript
import { logApiRoute } from '@/lib/logging/logger';

const startTime = Date.now();
// ... execute route
await logApiRoute('/api/billing/stripe/checkout', workspaceId, userId, 200, Date.now() - startTime);
```

---

## Alerting System

### Alert Types

- `payment_failed` – Subscription payment declined
- `webhook_error` – Failed to process webhook
- `manual_payment_pending` – Manual payment awaiting approval > 24h
- `quota_exceeded` – API rate limits or usage quota exceeded
- `rate_limit` – External service rate limit hit
- `system_error` – Unexpected application error

### Sending Alerts

```typescript
import { sendAlert, alertPaymentFailure } from '@/lib/logging/alerts';

// Generic alert
await sendAlert('payment_failed', 'Payment Failed', 'Order 123 failed to process', {
  orderId: '123',
  reason: 'Card declined',
});

// Specialized alert helpers
await alertPaymentFailure(workspaceId, subscriptionId, 'Card declined');
await alertWebhookFailure('stripe', 'invoice.payment_failed', 'JSON parse error');
await alertManualPaymentPending(5);
await alertRateLimitError('stripe', 60);
await alertSystemError('webhook processing', error);
```

### Email Alert Template

Alerts are sent as HTML emails with:
- Colored header based on alert type
- Alert title and message
- Metadata (key-value pairs)
- Link to admin logs dashboard
- Timestamp

Example recipient email: `alerts@retailassist.app` (set via `ALERT_EMAIL` env var)

### WhatsApp Alerts (Optional)

If `WHATSAPP_WEBHOOK_URL` is configured, critical alerts also send WhatsApp messages.

---

## Sentry Integration

### Setup

1. Create a Sentry account and project at https://sentry.io
2. Get your DSN (Data Source Name)
3. Set `SENTRY_DSN` environment variable

### Initialization

In your root layout:

```typescript
'use client';

import { initSentryClient } from '@/lib/logging/sentry';

initSentryClient();

export default function RootLayout({ children }) {
  return <html>{children}</html>;
}
```

In your middleware or API init:

```typescript
import { initSentryServer } from '@/lib/logging/sentry';

initSentryServer();
```

### Capturing Errors

```typescript
import { captureException, captureMessage } from '@/lib/logging/sentry';

try {
  // ... code
} catch (error) {
  captureException(error, { context: 'payment processing' });
}

captureMessage('Payment processing started', 'info', { orderId: '123' });
```

---

## Admin Logs Dashboard

Access at: `/app/admin/logs`

### Features

- **Filters**:
  - By level (debug, info, warning, error)
  - By source (api, webhook, background, ui)
  - By timestamp range
  - Full-text search in message

- **Display**:
  - Level badge with color coding
  - Source tag
  - Timestamp (local timezone)
  - Message (clickable to expand)

- **Expanded View**:
  - Workspace ID (if applicable)
  - User ID (if applicable)
  - Metadata (JSON)
  - Stack trace (for errors)

### Example Queries

Filter all payment failures:
```
Level: error
Source: api
Search: "payment"
```

View webhook processing issues:
```
Level: warning
Source: webhook
```

---

## Mock Mode Support

When `env.useMockPayments` is true:

1. **No real alerts sent** – Alerts logged to console only
2. **Webhook validation skipped** – Accept any signature
3. **Logs still recorded** – All events written to `system_logs`
4. **Sentry disabled** – Errors logged locally, not sent to Sentry

Example test webhook:

```bash
curl -X POST http://localhost:3000/api/billing/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_mock_123",
    "type": "invoice.payment_succeeded",
    "data": {
      "object": {
        "id": "in_mock_456",
        "amount_paid": 2900,
        "currency": "usd",
        "status": "paid"
      }
    }
  }'
```

In mock mode, no signature verification occurs.

---

## Best Practices

### When to Log

✅ **Always log:**
- External API calls (Stripe, PayPal, Facebook)
- User actions (create agent, delete workspace)
- Payment events (created, failed, refunded)
- Errors and exceptions
- Performance milestones (slow queries, rate limits)

❌ **Never log:**
- Passwords or API keys
- Credit card numbers
- PII (passwords, full email history)
- User session tokens
- OAuth refresh tokens

### Log Levels

- `debug` – Verbose info for development (disabled in production)
- `info` – Important events (payment received, subscription activated)
- `warning` – Potential issues (rate limit approaching, grace period started)
- `error` – Errors that require attention (payment failed, webhook failed)

### Metadata Guidelines

Keep metadata relevant and concise:

```typescript
// Good
await logger.info('Payment received', {
  subscriptionId: '123',
  amount: 29.00,
  provider: 'stripe',
});

// Avoid
await logger.info('Payment received', {
  userId: '123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  creditCardLast4: '4242',
  // ... everything in the database
});
```

---

## Example Workflow

### Payment Processing with Logging

```typescript
import { createLogger } from '@/lib/logging/logger';
import { alertPaymentFailure } from '@/lib/logging/alerts';

const logger = createLogger('api', workspaceId, userId);

export async function POST(req: Request) {
  try {
    logger.info('Stripe checkout initiated', { planId });

    // Call Stripe
    const sessionRes = await createCheckoutSession({ ... });

    logger.info('Checkout session created', {
      sessionId: sessionRes.sessionId,
      amount: plan.price_monthly,
    });

    return NextResponse.json(sessionRes);
  } catch (error) {
    logger.error('Checkout failed', error, { planId });
    
    if (error.code === 'insufficient_funds') {
      await alertPaymentFailure(workspaceId, subscriptionId, 'Insufficient funds');
    }

    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
```

---

## Monitoring & Alerts

### Auto-Triggered Alerts

The system automatically sends alerts for:

1. **Payment Failures**
   - Triggered: Invoice marked failed
   - Email to: `ALERT_EMAIL`
   - Info: workspace, subscription, reason

2. **Webhook Errors**
   - Triggered: Failed to parse/verify webhook
   - Email to: `ALERT_EMAIL`
   - Info: provider, event type, error message

3. **Manual Payment Pending > 24h**
   - Triggered: Scheduled job (daily)
   - Email to: `ALERT_EMAIL`
   - Info: count, oldest pending timestamp

4. **Rate Limits**
   - Triggered: API returns 429
   - Email to: `ALERT_EMAIL`
   - Info: service, retry-after header

---

## Environment Variables

```bash
# Logging
SENTRY_DSN=https://...@sentry.io/...

# Alerts
ALERT_EMAIL=ops@retailassist.app
WHATSAPP_WEBHOOK_URL=https://...  # Optional

# Mock Mode (disable real alerts in dev)
NEXT_PUBLIC_USE_MOCK_PAYMENTS=true
```

---

## Troubleshooting

**Q: Logs not appearing in admin dashboard?**
- Check RLS policies on `system_logs` table
- Verify user is admin of a workspace
- Check timestamp filters (logs may be old)

**Q: Alerts not being sent?**
- Verify `ALERT_EMAIL` is configured
- Check email service credentials
- Test with `NEXT_PUBLIC_USE_MOCK_PAYMENTS=false` locally

**Q: Sentry not capturing errors?**
- Verify `SENTRY_DSN` is set
- Check browser console for SDK errors
- Sentry must be initialized before errors occur

---

## Testing

### Unit Test Example

```typescript
import { createLogger } from '@/lib/logging/logger';

describe('Logger', () => {
  it('logs to system_logs table', async () => {
    const logger = createLogger('test', 'workspace-1', 'user-1');
    await logger.info('Test message', { test: true });

    const { data } = await supabase
      .from('system_logs')
      .select('*')
      .eq('source', 'test')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    expect(data.message).toBe('Test message');
    expect(data.metadata.test).toBe(true);
  });
});
```

### Integration Test Example

```typescript
it('sends alert on payment failure', async () => {
  // Mock email service
  const emailSpy = vi.spyOn(emailService, 'send');

  await alertPaymentFailure(workspaceId, subscriptionId, 'Card declined');

  expect(emailSpy).toHaveBeenCalledWith({
    to: 'ops@retailassist.app',
    subject: '[ALERT] Payment Failed',
    // ...
  });
});
```

---

## Future Enhancements

- [ ] Real-time log streaming (WebSocket)
- [ ] Trend analysis and anomaly detection
- [ ] Automated remediation (retry failed webhooks)
- [ ] PagerDuty integration for on-call alerts
- [ ] Slack integration for team notifications
- [ ] Log retention and archival policies
- [ ] Cost tracking per workspace
