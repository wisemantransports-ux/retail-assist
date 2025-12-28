# Webhook Module - Quick Reference

## File Structure

```
app/lib/webhooks/
├── webhook-utils.ts              # Shared utilities
├── webhooks-shim.d.ts            # Type declarations
├── facebook-webhook.ts           # Facebook handler
├── instagram-webhook.ts          # Instagram handler
├── whatsapp-webhook.ts           # WhatsApp handler
├── website-form-webhook.ts       # Website form handler
├── README.md                      # Module documentation
├── WEBHOOK_INTEGRATION.md         # Integration guide
└── __tests__/
    └── webhook-handlers.test.js   # 20 test cases
```

## Quick API Reference

### Facebook Handler

```typescript
import { handleFacebookWebhook } from '@/lib/webhooks/facebook-webhook';

async function POST(request: Request) {
  const signature = request.headers.get('X-Hub-Signature-256');
  const secret = process.env.FACEBOOK_WEBHOOK_SECRET;
  const result = await handleFacebookWebhook(request, signature, secret);
  return Response.json(result);
}
```

### Instagram Handler

```typescript
import { handleInstagramWebhook } from '@/lib/webhooks/instagram-webhook';

async function POST(request: Request) {
  const signature = request.headers.get('X-Hub-Signature-256');
  const secret = process.env.INSTAGRAM_WEBHOOK_SECRET;
  const result = await handleInstagramWebhook(request, signature, secret);
  return Response.json(result);
}
```

### WhatsApp Handler

```typescript
import { handleWhatsAppWebhook, verifyWhatsAppWebhookChallenge } from '@/lib/webhooks/whatsapp-webhook';

async function POST(request: Request) {
  const signature = request.headers.get('X-Twilio-Signature');
  const token = process.env.WHATSAPP_AUTH_TOKEN;
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`;
  const result = await handleWhatsAppWebhook(request, token, webhookUrl);
  return Response.json(result);
}

function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const verification = verifyWhatsAppWebhookChallenge(request, verifyToken);
  return verification.valid && verification.challenge
    ? new Response(verification.challenge)
    : new Response('Forbidden', { status: 403 });
}
```

### Website Form Handler

```typescript
import { handleWebsiteFormWebhook } from '@/lib/webhooks/website-form-webhook';

async function POST(request: Request) {
  const signature = request.headers.get('X-Signature');
  const secret = process.env.FORM_WEBHOOK_SECRET;
  const result = await handleWebsiteFormWebhook(request, signature, secret);
  return Response.json(result);
}
```

## Shared Utilities

### Signature Verification

```typescript
import {
  verifyFacebookSignature,
  verifyInstagramSignature,
  verifyWhatsAppSignature,
  verifyWebsiteFormSignature,
} from '@/lib/webhooks/webhook-utils';

// All return { valid: boolean, error?: string }
const result = verifyFacebookSignature(payload, signature, secret);
```

### Payload Parsing

```typescript
import {
  parseCommentPayload,
  parseDmPayload,
  parseWebhookEvent,
  safeJsonParse,
} from '@/lib/webhooks/webhook-utils';

const comment = parseCommentPayload(payload);
const dm = parseDmPayload(payload);
const event = parseWebhookEvent(payload, 'facebook');
const json = safeJsonParse(jsonString);
```

### Validation

```typescript
import {
  validateWorkspaceAndSubscription,
  extractWorkspaceIdFromPayload,
  extractAgentIdFromPayload,
} from '@/lib/webhooks/webhook-utils';

const validation = await validateWorkspaceAndSubscription(workspaceId, supabase);
const wsId = extractWorkspaceIdFromPayload(payload, 'facebook');
const agentId = extractAgentIdFromPayload(payload, 'facebook');
```

### Logging

```typescript
import { logWebhookEvent } from '@/lib/webhooks/webhook-utils';

logWebhookEvent('facebook', 'webhook', 'received', { changes: 1 });
logWebhookEvent('facebook', 'comment', 'executed', { ruleMatched: true });
logWebhookEvent('facebook', 'webhook', 'failed', { error: 'Invalid signature' });
```

## Environment Variables

```bash
# Facebook
FACEBOOK_WEBHOOK_SECRET=abc123...          # App Secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=mytoken      # Custom verify token

# Instagram (same format as Facebook)
INSTAGRAM_WEBHOOK_SECRET=def456...
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=mytoken

# WhatsApp
WHATSAPP_AUTH_TOKEN=ghi789...             # Auth token from WhatsApp
WHATSAPP_VERIFY_TOKEN=mytoken             # Custom verify token
NEXT_PUBLIC_APP_URL=https://example.com   # For signature verification

# Website Forms
FORM_WEBHOOK_SECRET=jkl012...             # Shared HMAC secret

# Optional
USE_MOCK_MODE=false                        # Set true for testing
```

## Response Format

All handlers return:

```typescript
interface WebhookResult {
  ok: boolean;                   // true if successful
  status: number;                // HTTP status (200, 400, 403, 500)
  message: string;               // Description
  rulesExecuted?: number;        // Rules that matched
  errors?: string[];             // List of errors
}
```

## Platform Differences

| Aspect | Facebook/Instagram | WhatsApp | Website |
|--------|-------------------|----------|---------|
| **Header** | X-Hub-Signature-256 | X-Twilio-Signature | X-Signature |
| **Algorithm** | HMAC-SHA256 | HMAC-SHA1 | HMAC-SHA256 |
| **Format** | sha256=abc... | base64 | hex |
| **Verification Payload** | Raw body | URL + body | Raw body |
| **Challenge** | Query params | Query params | N/A |
| **Event Types** | feed, messages | messages, statuses | All form fields |

## Common Patterns

### Creating an API Endpoint

```typescript
// app/api/webhooks/[platform]/route.ts
import { handle[Platform]Webhook } from '@/lib/webhooks/[platform]-webhook';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('X-...');
    const secret = process.env.[PLATFORM]_WEBHOOK_SECRET;
    
    if (!secret) {
      return Response.json({ error: 'Missing secret' }, { status: 500 });
    }
    
    const result = await handle[Platform]Webhook(request, signature, secret);
    return Response.json(result, { status: result.status });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

export function GET(request: Request) {
  // Platform-specific challenge handling
}
```

### Testing Signature Generation

```javascript
const crypto = require('crypto');

// Facebook/Instagram
const fbSecret = 'your_secret';
const payload = JSON.stringify({ test: 'data' });
const hash = crypto.createHmac('sha256', fbSecret).update(payload).digest('hex');
const fbSig = `sha256=${hash}`;

// WhatsApp
const waSecret = 'your_token';
const waUrl = 'https://api.example.com/webhooks/whatsapp';
const waData = waUrl + payload;
const waHash = crypto.createHmac('sha1', waSecret).update(waData).digest('base64');

// Website
const formSecret = 'your_secret';
const formHash = crypto.createHmac('sha256', formSecret).update(payload).digest('hex');
```

### Mock Testing

```bash
# Enable mock mode
export USE_MOCK_MODE=true

# Webhooks will:
# - Skip executor invocation
# - Log events as processed
# - Return success responses
```

## Testing

```bash
# Run all tests
node app/lib/webhooks/__tests__/webhook-handlers.test.js

# Expected: 20/20 tests pass
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Signature fails | Verify secret matches platform, use raw body |
| No rules execute | Check workspace exists, subscription active, rules configured |
| Webhook doesn't arrive | Verify URL in platform dashboard, enable logging |
| Parsing errors | Check payload format for platform, enable debug logs |
| Performance issues | Enable mock mode, check executor performance separately |

## Deployment Checklist

- [ ] Set all environment variables (never commit secrets)
- [ ] Create webhook API endpoints
- [ ] Configure webhooks on platform dashboards
- [ ] Test signature generation with real secrets
- [ ] Run test suite (20/20 should pass)
- [ ] Test with mock mode first
- [ ] Monitor logs in production
- [ ] Set up alerting for webhook failures

## Key Features

✅ **Signature Verification** - Validates webhook authenticity for all platforms  
✅ **Flexible Payload Parsing** - Handles platform-specific payload formats  
✅ **Workspace Validation** - Ensures workspace exists and subscription is active  
✅ **Executor Integration** - Seamlessly triggers automation rules  
✅ **Error Handling** - Standardized error responses with detailed messages  
✅ **Logging** - Comprehensive event logging for debugging  
✅ **Type Safety** - TypeScript with minimal type declarations  
✅ **Mock Mode** - Development testing without real integrations  
✅ **No Schema Changes** - Works with existing executor and tables  
✅ **Tested** - 20 passing tests covering all functionality  

## References

- **Full Integration Guide:** `WEBHOOK_INTEGRATION.md`
- **Module Documentation:** `README.md`
- **Executor Module:** `app/lib/automation/executeAutomationRules.ts`
- **Test Suite:** `__tests__/webhook-handlers.test.js`
