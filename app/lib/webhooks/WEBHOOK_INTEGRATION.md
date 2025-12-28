# Webhook Integration Guide

This guide explains how to integrate the webhook handlers with the automation executor for live event processing from Facebook, Instagram, WhatsApp, and website forms.

## Overview

The webhook handlers (`facebook-webhook.ts`, `instagram-webhook.ts`, `whatsapp-webhook.ts`, `website-form-webhook.ts`) provide signature verification, payload parsing, and automation rule execution for incoming messages and comments from various platforms.

**Key Files:**
- `app/lib/webhooks/webhook-utils.ts` - Shared utilities (signature verification, logging)
- `app/lib/webhooks/facebook-webhook.ts` - Facebook Messenger & Comments handler
- `app/lib/webhooks/instagram-webhook.ts` - Instagram Comments & DMs handler
- `app/lib/webhooks/whatsapp-webhook.ts` - WhatsApp Messages handler
- `app/lib/webhooks/website-form-webhook.ts` - Website form submissions handler
- `app/lib/automation/executeAutomationRules.ts` - Core automation executor

## Architecture

```
Webhook Event → Handler (Signature Verification)
                    ↓
              Payload Parsing
                    ↓
           Workspace Validation
                    ↓
      Automation Executor
          (Rule Matching & Action Execution)
                    ↓
              Response Sent
```

## Supported Platforms

### Facebook Messenger & Comments
- **Event Types:** Comments, Direct Messages
- **Signature Header:** `X-Hub-Signature-256`
- **Handler:** `handleFacebookWebhook()`

### Instagram Comments & DMs
- **Event Types:** Comments, Direct Messages
- **Signature Header:** `X-Hub-Signature-256`
- **Handler:** `handleInstagramWebhook()`

### WhatsApp Messages
- **Event Types:** Incoming Messages, Status Updates
- **Signature Header:** `X-Twilio-Signature`
- **Handler:** `handleWhatsAppWebhook()`

### Website Forms
- **Event Types:** Form Submissions
- **Signature Header:** `X-Signature` (custom HMAC-SHA256)
- **Handler:** `handleWebsiteFormWebhook()`

## Integration Examples

### 1. Facebook Webhook Endpoint

**File:** `app/api/webhooks/facebook/route.ts`

```typescript
import { handleFacebookWebhook } from '@/lib/webhooks/facebook-webhook';

export async function POST(request: Request) {
  const signature = request.headers.get('X-Hub-Signature-256');
  const secret = process.env.FACEBOOK_WEBHOOK_SECRET;

  if (!secret) {
    return new Response(JSON.stringify({ error: 'Missing webhook secret' }), {
      status: 500,
    });
  }

  const result = await handleFacebookWebhook(request, signature, secret);
  return new Response(JSON.stringify(result), { status: result.status });
}

// Handle webhook challenge (Facebook verification)
export function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge);
  }

  return new Response('Forbidden', { status: 403 });
}
```

### 2. Instagram Webhook Endpoint

**File:** `app/api/webhooks/instagram/route.ts`

```typescript
import { handleInstagramWebhook } from '@/lib/webhooks/instagram-webhook';

export async function POST(request: Request) {
  const signature = request.headers.get('X-Hub-Signature-256');
  const secret = process.env.INSTAGRAM_WEBHOOK_SECRET;

  if (!secret) {
    return new Response(JSON.stringify({ error: 'Missing webhook secret' }), {
      status: 500,
    });
  }

  const result = await handleInstagramWebhook(request, signature, secret);
  return new Response(JSON.stringify(result), { status: result.status });
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge);
  }

  return new Response('Forbidden', { status: 403 });
}
```

### 3. WhatsApp Webhook Endpoint

**File:** `app/api/webhooks/whatsapp/route.ts`

```typescript
import { handleWhatsAppWebhook, verifyWhatsAppWebhookChallenge } from '@/lib/webhooks/whatsapp-webhook';

export async function POST(request: Request) {
  const signature = request.headers.get('X-Twilio-Signature');
  const token = process.env.WHATSAPP_AUTH_TOKEN;
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`;

  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), {
      status: 500,
    });
  }

  const result = await handleWhatsAppWebhook(request, token, webhookUrl);
  return new Response(JSON.stringify(result), { status: result.status });
}

export function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const verification = verifyWhatsAppWebhookChallenge(request, verifyToken || '');

  if (verification.valid && verification.challenge) {
    return new Response(verification.challenge);
  }

  return new Response('Forbidden', { status: 403 });
}
```

### 4. Website Form Webhook Endpoint

**File:** `app/api/webhooks/forms/route.ts`

```typescript
import { handleWebsiteFormWebhook } from '@/lib/webhooks/website-form-webhook';

export async function POST(request: Request) {
  const signature = request.headers.get('X-Signature');
  const secret = process.env.FORM_WEBHOOK_SECRET;
  const workspaceId = request.headers.get('X-Workspace-ID');
  const agentId = request.headers.get('X-Agent-ID');

  if (!secret) {
    return new Response(JSON.stringify({ error: 'Missing webhook secret' }), {
      status: 500,
    });
  }

  const result = await handleWebsiteFormWebhook(
    request,
    signature,
    secret,
    workspaceId || undefined,
    agentId || undefined
  );

  return new Response(JSON.stringify(result), { status: result.status });
}
```

## Environment Variables

Add these to your `.env.local` or `.env` file:

```env
# Facebook
FACEBOOK_WEBHOOK_SECRET=your_facebook_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_verify_token

# Instagram
INSTAGRAM_WEBHOOK_SECRET=your_instagram_app_secret
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your_verify_token

# WhatsApp
WHATSAPP_AUTH_TOKEN=your_whatsapp_auth_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Website Forms
FORM_WEBHOOK_SECRET=your_form_secret

# Optional
USE_MOCK_MODE=false  # Set to true for testing without real integrations
```

## Webhook Configuration

### Facebook/Instagram Setup

1. **Create Facebook App:** https://developers.facebook.com/
2. **Add Webhooks Product:** 
   - Navigate to Products → Add Product → Webhooks
   - Select "Page" (for Comments) and "Instagram" resources
3. **Configure Webhook URL:**
   - Callback URL: `https://your-domain.com/api/webhooks/facebook`
   - Verify Token: Use value from `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
4. **Subscribe to Events:**
   - `feed` - Page post comments
   - `messages` - Page Inbox (Messenger)
5. **Get App Secret:**
   - Settings → Basic → App Secret (use as `FACEBOOK_WEBHOOK_SECRET`)

### WhatsApp Setup

1. **Create Business Account:** https://www.whatsapp.com/business/
2. **Get Auth Token:** From WhatsApp Business API dashboard
3. **Configure Webhook:**
   - Callback URL: `https://your-domain.com/api/webhooks/whatsapp`
   - Verify Token: Use value from `WHATSAPP_VERIFY_TOKEN`
4. **Subscribe to Events:** `messages`, `message_status`

### Website Forms Setup

1. **Generate Shared Secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Distribute to Form Clients:**
   - Use to generate signatures when posting to webhook
3. **Example Client Code:**
   ```javascript
   const crypto = require('crypto');
   const secret = process.env.FORM_WEBHOOK_SECRET;
   const payload = JSON.stringify({
     name: 'John',
     email: 'john@example.com',
     message: 'Hello'
   });
   const signature = crypto
     .createHmac('sha256', secret)
     .update(payload)
     .digest('hex');

   fetch('/api/webhooks/forms', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'X-Signature': signature,
       'X-Workspace-ID': workspaceId,
       'X-Agent-ID': agentId,
     },
     body: payload,
   });
   ```

## Automation Executor Integration

The webhook handlers automatically invoke the automation executor:

```
For Comments/Posts:
  → executeAutomationRulesForComment(input)
  → Checks: comment, keyword triggers
  → Actions: send_dm, send_public_reply, send_email, send_webhook

For Messages/Form Submissions:
  → executeAutomationRulesForMessage(input)
  → Checks: comment, keyword, time, manual triggers
  → Actions: send_dm, send_public_reply, send_email, send_webhook
```

### Input Format

```typescript
interface AutomationInput {
  workspaceId: string;      // Workspace ID
  agentId: string;           // Agent ID for the platform
  commentId: string;         // Unique message ID
  commentText: string;       // Message content
  authorId: string;          // Sender's platform ID
  authorName: string;        // Sender's display name
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'website';
  messageType: string;       // 'comment', 'message', 'form_submission'
  metadata?: {
    formSource?: string;     // Form name/ID
    submissionTimestamp?: number;
    [key: string]: any;
  };
}
```

## Testing & Mock Mode

### Enable Mock Mode

```env
USE_MOCK_MODE=true
```

In mock mode, webhook handlers log events without executing real automation rules.

### Test Webhook Signatures

```bash
# Facebook/Instagram Test Signature
node -e "
const crypto = require('crypto');
const payload = '{\"test\":\"data\"}';
const secret = 'test_secret';
const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('X-Hub-Signature-256: sha256=' + hash);
"

# Website Form Test Signature
node -e "
const crypto = require('crypto');
const payload = '{\"name\":\"test\"}';
const secret = 'your_form_secret';
const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('X-Signature: ' + hash);
"
```

### Manual Testing

```bash
# Test Facebook webhook
curl -X POST http://localhost:3000/api/webhooks/facebook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"entry":[{"changes":[{"field":"feed","value":{"message":"Test comment","from":{"id":"123","name":"Test User"}}}]}]}'

# Test website form
curl -X POST http://localhost:3000/api/webhooks/forms \
  -H "Content-Type: application/json" \
  -H "X-Signature: ..." \
  -H "X-Workspace-ID: ws_123" \
  -H "X-Agent-ID: ag_123" \
  -d '{"name":"John","email":"john@example.com","message":"Help please"}'
```

## Error Handling

All webhook handlers return standardized responses:

```typescript
interface WebhookResult {
  ok: boolean;
  status: number;           // HTTP status code
  message: string;          // Human-readable message
  rulesExecuted?: number;   // Number of rules executed
  errors?: string[];        // List of errors encountered
}
```

**Status Codes:**
- `200` - Webhook processed successfully
- `400` - Invalid payload or missing required fields
- `403` - Signature verification failed or subscription inactive
- `500` - Internal server error

## Logging

All webhook events are logged with the following format:

```
[platform] event status: { timestamp, metadata... }
```

Examples:
```
[Webhook] FACEBOOK webhook received: { changes: 1 }
[Webhook] FACEBOOK webhook verified: {}
[Webhook] FACEBOOK comment parsed: { workspace: 'ws_123', agent: 'ag_123' }
[Webhook] FACEBOOK comment executed: { ruleMatched: true, actionExecuted: true }
```

## Troubleshooting

### Signature Verification Fails
1. **Verify the secret:** Ensure `FACEBOOK_WEBHOOK_SECRET` matches app secret
2. **Check payload:** Ensure raw JSON body is used (not parsed)
3. **Platform differences:**
   - Facebook/Instagram use SHA256
   - WhatsApp uses SHA1
   - Website uses SHA256

### No Automations Trigger
1. **Check workspace validation:** Ensure workspace exists and has active subscription
2. **Verify agent exists:** Agent must exist for the platform
3. **Check trigger conditions:** Ensure automation rules match incoming message type
4. **Enable logging:** Set `DEBUG=true` to see detailed logs

### Webhook Endpoint Not Responding
1. **Verify endpoint registered:** Check routing in `app/api/webhooks/*/route.ts`
2. **Check environment variables:** Ensure all required env vars are set
3. **Review logs:** Check server logs for error messages

## Security Considerations

1. **Always verify signatures** - Prevents unauthorized webhook calls
2. **Use HTTPS** - All webhook endpoints should be HTTPS
3. **Rotate secrets regularly** - Update webhook secrets periodically
4. **Rate limiting** - Consider adding rate limit middleware if high volume
5. **Workspace isolation** - Webhooks respect RLS and workspace boundaries

## Performance

Webhook handlers are designed to be fast:
- Signature verification: ~1ms
- Payload parsing: ~2-5ms
- Automation execution: ~50-200ms (depends on rule complexity)

**Total latency:** 50-300ms typical

For high-volume scenarios, consider:
- Async job queue for rule execution
- Caching workspace/agent lookups
- Batching similar events

## Next Steps

1. **Create API endpoints** following the examples above
2. **Set environment variables** for each platform
3. **Configure webhooks** on each platform's dashboard
4. **Test with mock data** using the test examples
5. **Monitor logs** for successful event processing
6. **Create automation rules** in the dashboard
7. **Test end-to-end** with real events

## Support

For issues or questions:
1. Check webhook logs at `/api/webhooks/*/` endpoints
2. Review executor logs in `executeAutomationRules.ts`
3. Verify environment variables and secrets
4. Test signature generation locally before deploying
