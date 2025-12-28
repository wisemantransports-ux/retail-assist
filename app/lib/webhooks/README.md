# Webhook Module

Real-time webhook integration for the automation executor. Handles incoming messages and comments from Facebook, Instagram, WhatsApp, and website forms, triggering automation rules based on defined triggers and actions.

## Files

### Core Handlers
- **`facebook-webhook.ts`** - Facebook Messenger & Comments webhook handler
  - Signature verification (X-Hub-Signature-256)
  - Comment and DM message parsing
  - Executor invocation for matched rules
  
- **`instagram-webhook.ts`** - Instagram Comments & DMs webhook handler
  - Same Graph API format as Facebook
  - Comment and DM processing
  - Platform-specific rule matching

- **`whatsapp-webhook.ts`** - WhatsApp Messages webhook handler
  - Twilio-style signature verification (X-Twilio-Signature)
  - Support for text, audio, image, video, document messages
  - Status update handling
  - Webhook challenge response for verification

- **`website-form-webhook.ts`** - Website form submissions webhook handler
  - HMAC-SHA256 signature verification
  - Flexible form field name parsing
  - Metadata extraction for custom forms
  - Submission ID generation

### Utilities & Support
- **`webhook-utils.ts`** - Shared utilities for all handlers
  - Signature verification (Facebook, Instagram, WhatsApp, website)
  - Payload parsing helpers
  - Workspace and subscription validation
  - Safe JSON parsing
  - Event logging with optional database persistence

- **`webhooks-shim.d.ts`** - Type declarations
  - Minimal ambient types for executor imports
  - AutomationInput and AutomationResult interfaces
  - Global environment and function types
  - No repo-wide type checking required

### Tests & Documentation
- **`__tests__/webhook-handlers.test.js`** - 20 comprehensive tests
  - Signature verification (valid/invalid/missing)
  - Payload parsing (valid/malformed/incomplete)
  - Workspace validation
  - Form submission parsing with field variations
  - Edge cases (empty payload, large payloads, Unicode)
  - Concurrent request simulation

- **`WEBHOOK_INTEGRATION.md`** - Complete integration guide
  - Platform setup instructions
  - API endpoint examples (4 platforms)
  - Environment variable configuration
  - Testing procedures and examples
  - Troubleshooting guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

```bash
# .env.local
FACEBOOK_WEBHOOK_SECRET=your_secret_here
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_token
INSTAGRAM_WEBHOOK_SECRET=your_secret_here
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your_token
WHATSAPP_AUTH_TOKEN=your_token_here
WHATSAPP_VERIFY_TOKEN=your_token
FORM_WEBHOOK_SECRET=your_secret_here
USE_MOCK_MODE=false
```

### 3. Create API Endpoints

Create webhook endpoint files for each platform (see `WEBHOOK_INTEGRATION.md` for examples):

```
app/api/webhooks/
  ├── facebook/route.ts
  ├── instagram/route.ts
  ├── whatsapp/route.ts
  └── forms/route.ts
```

### 4. Test Webhooks

Run the test suite:

```bash
node app/lib/webhooks/__tests__/webhook-handlers.test.js
```

Expected output:
```
=== FACEBOOK WEBHOOK HANDLER TESTS ===
✓ Facebook signature verification - valid signature
✓ Facebook signature verification - invalid signature
...
=== TEST SUMMARY ===
Total Tests: 20
✓ All tests completed successfully
```

## Usage

### Handle Facebook Webhook

```typescript
import { handleFacebookWebhook } from '@/lib/webhooks/facebook-webhook';

const result = await handleFacebookWebhook(
  request,           // HTTP Request
  signature,         // X-Hub-Signature-256 header
  appSecret          // Facebook App Secret
);

// Returns: { ok: boolean, status: number, message: string, rulesExecuted: number, errors?: string[] }
```

### Handle Instagram Webhook

```typescript
import { handleInstagramWebhook } from '@/lib/webhooks/instagram-webhook';

const result = await handleInstagramWebhook(
  request,           // HTTP Request
  signature,         // X-Hub-Signature-256 header
  appSecret          // Instagram App Secret
);
```

### Handle WhatsApp Webhook

```typescript
import { handleWhatsAppWebhook } from '@/lib/webhooks/whatsapp-webhook';

const result = await handleWhatsAppWebhook(
  request,           // HTTP Request
  authToken,         // WhatsApp Auth Token
  webhookUrl         // Your webhook URL for signature verification
);
```

### Handle Website Form

```typescript
import { handleWebsiteFormWebhook } from '@/lib/webhooks/website-form-webhook';

const result = await handleWebsiteFormWebhook(
  request,           // HTTP Request
  signature,         // X-Signature header
  secret,            // Shared secret for HMAC
  workspaceId,       // Optional, can be in payload
  agentId            // Optional, can be in payload
);
```

## Supported Message Types

### Facebook/Instagram
- **Comments:** Text comments on posts/pages
- **Messages:** Direct messages via Messenger/Instagram DM
- **Metadata:** Author ID, author name, post ID, timestamp

### WhatsApp
- **Text Messages:** Plain text content
- **Media Messages:** Audio, image, video, documents
- **Status Updates:** Message delivery/read status
- **Metadata:** Sender phone, message type, timestamp

### Website Forms
- **Flexible Fields:** name, email, message (with flexible naming)
- **Subject/Topic:** Optional descriptive fields
- **Custom Fields:** Any additional form data preserved as metadata
- **Metadata:** Form source, submission timestamp, custom fields

## Automation Rule Execution

When a webhook is received, it:

1. **Verifies Signature** - Ensures webhook authenticity
2. **Validates Workspace** - Checks workspace exists and subscription is active
3. **Parses Message** - Extracts relevant message data
4. **Calls Executor** - Invokes `executeAutomationRulesForComment()` or `executeAutomationRulesForMessage()`
5. **Logs Event** - Records webhook processing status

### Supported Triggers

Webhooks can trigger the following automation rules:

- **Comment Trigger** - On any incoming comment/message
- **Keyword Trigger** - On message containing specific keywords
- **Time Trigger** - Scheduled rules (can be triggered by webhook for time-based actions)
- **Manual Trigger** - User-initiated rules

### Supported Actions

Rules triggered by webhooks can execute:

- **Send DM** - Reply directly to the sender
- **Send Public Reply** - Public comment/response
- **Send Email** - Queue email notification
- **Send Webhook** - Forward to external webhook

## Error Handling

All handlers implement standardized error handling:

```typescript
interface WebhookResult {
  ok: boolean;
  status: number;        // 200, 400, 403, 500
  message: string;       // Human-readable error/success
  rulesExecuted?: number;
  errors?: string[];     // Array of error messages
}
```

### Common Error Scenarios

| Status | Scenario | Cause |
|--------|----------|-------|
| 200 | Success | Webhook processed, rules executed |
| 400 | Bad Request | Invalid JSON, missing required fields |
| 403 | Forbidden | Signature verification failed, inactive subscription |
| 500 | Server Error | Executor error, validation failure |

## Logging

All webhook events are logged with timestamps and metadata:

```
[Webhook] FACEBOOK webhook received: { changes: 1 }
[Webhook] FACEBOOK webhook verified: {}
[Webhook] FACEBOOK comment parsed: { workspace: 'ws_123', agent: 'ag_456' }
[Webhook] FACEBOOK comment executed: { ruleMatched: true, actionExecuted: true }
```

## Mock Mode

For development and testing without real integrations:

```bash
USE_MOCK_MODE=true
```

In mock mode, webhook handlers:
- Skip executor invocation
- Log all events as processed
- Return success responses
- Allow testing without database access

## Performance

Expected latency for webhook processing:

- **Signature Verification:** ~1ms
- **Payload Parsing:** ~2-5ms
- **Workspace Validation:** ~20-50ms
- **Automation Execution:** ~50-200ms
- **Total:** 70-300ms

## Testing

### Run Tests

```bash
node app/lib/webhooks/__tests__/webhook-handlers.test.js
```

### Test Individual Handlers

```typescript
// Test signature verification
import { verifyFacebookSignature } from '@/lib/webhooks/webhook-utils';

const payload = JSON.stringify({ test: 'data' });
const secret = 'app_secret';
const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
const result = verifyFacebookSignature(payload, `sha256=${hash}`, secret);
// result.valid === true
```

### Manual Webhook Testing

```bash
# Test with curl (requires valid signature)
curl -X POST http://localhost:3000/api/webhooks/facebook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"entry":[{"changes":[{"field":"feed","value":{"message":"Test"}}]}]}'
```

## Integration Checklist

- [ ] Create webhook endpoints in `app/api/webhooks/`
- [ ] Set all required environment variables
- [ ] Configure webhooks on platform dashboards
- [ ] Test signature generation locally
- [ ] Run webhook test suite (`npm test`)
- [ ] Verify automation rules exist
- [ ] Enable webhook logs in monitoring
- [ ] Test with mock mode first
- [ ] Test with real events from platforms

## Troubleshooting

### Signature Verification Fails
- Verify the secret matches the platform's app secret
- Ensure using raw request body (not parsed JSON)
- Check for whitespace or encoding differences

### No Automations Execute
- Verify workspace exists and subscription is active
- Check agent is configured for the platform
- Ensure automation rules exist and match trigger type
- Check logs for parsing or validation errors

### Webhook Endpoint Errors
- Verify endpoint file exists at correct path
- Check environment variables are loaded
- Review server logs for detailed errors
- Test with mock mode to isolate executor issues

## Architecture Decisions

1. **Separate Handlers per Platform** - Each platform has different signature verification and payload format requirements
2. **Shared Utilities** - Common signature verification, parsing, and logging to reduce duplication
3. **Type Shim** - Minimal type declarations to avoid repo-wide type checking issues
4. **Mock Mode** - Development/testing support without real database access
5. **Workspace Validation** - All webhooks validate workspace and subscription before executor invocation
6. **Executor Integration** - Uses existing executor; no endpoint or schema changes

## Future Enhancements

- [ ] Async job queue for high-volume webhook processing
- [ ] Webhook payload caching for retry logic
- [ ] Advanced rate limiting per platform
- [ ] Webhook signature rotation support
- [ ] Event deduplication for failed deliveries
- [ ] Metrics and analytics dashboard
- [ ] A/B testing support for webhook variants

## Related Files

- **Automation Executor:** `app/lib/automation/executeAutomationRules.ts`
- **Type Shim:** `app/lib/automation/automation-shim.d.ts`
- **Validation:** `app/lib/automation/validation.ts`
- **Tests:** `app/lib/automation/__tests__/`

## Dependencies

- `crypto` (Node.js built-in) - HMAC signature generation/verification
- `next` - HTTP request/response handling
- Executor module imports (type-safe via shim)

No additional npm packages required.
