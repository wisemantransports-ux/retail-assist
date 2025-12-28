/**
 * EXAMPLE: Complete Webhook Implementation
 * 
 * This file shows how to implement all webhook endpoints.
 * Create these files in your app/api/webhooks/ directory.
 * 
 * Files to create:
 * - app/api/webhooks/facebook/route.ts
 * - app/api/webhooks/instagram/route.ts
 * - app/api/webhooks/whatsapp/route.ts
 * - app/api/webhooks/forms/route.ts
 */

// ============================================================
// FILE: app/api/webhooks/facebook/route.ts
// ============================================================

import { handleFacebookWebhook } from '@/lib/webhooks/facebook-webhook';

/**
 * POST /api/webhooks/facebook
 * Handle incoming Facebook Messenger and Comments webhooks
 */
export async function POST(request: Request) {
  try {
    const signature = request.headers.get('X-Hub-Signature-256');
    const secret = process.env.FACEBOOK_WEBHOOK_SECRET;

    if (!secret) {
      console.error('Facebook webhook: Missing FACEBOOK_WEBHOOK_SECRET');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await handleFacebookWebhook(request, signature, secret);

    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Facebook webhook error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        status: 500,
        message: 'Internal server error',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/webhooks/facebook
 * Handle Facebook webhook verification challenge
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    console.log('Facebook webhook verified');
    return new Response(challenge);
  }

  console.warn('Facebook webhook verification failed - invalid token or challenge');
  return new Response('Forbidden', { status: 403 });
}

// ============================================================
// FILE: app/api/webhooks/instagram/route.ts
// ============================================================

import { handleInstagramWebhook } from '@/lib/webhooks/instagram-webhook';

/**
 * POST /api/webhooks/instagram
 * Handle incoming Instagram Comments and DMs webhooks
 */
export async function POST(request: Request) {
  try {
    const signature = request.headers.get('X-Hub-Signature-256');
    const secret = process.env.INSTAGRAM_WEBHOOK_SECRET;

    if (!secret) {
      console.error('Instagram webhook: Missing INSTAGRAM_WEBHOOK_SECRET');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await handleInstagramWebhook(request, signature, secret);

    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Instagram webhook error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        status: 500,
        message: 'Internal server error',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/webhooks/instagram
 * Handle Instagram webhook verification challenge
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    console.log('Instagram webhook verified');
    return new Response(challenge);
  }

  console.warn('Instagram webhook verification failed - invalid token or challenge');
  return new Response('Forbidden', { status: 403 });
}

// ============================================================
// FILE: app/api/webhooks/whatsapp/route.ts
// ============================================================

import {
  handleWhatsAppWebhook,
  verifyWhatsAppWebhookChallenge,
} from '@/lib/webhooks/whatsapp-webhook';

/**
 * POST /api/webhooks/whatsapp
 * Handle incoming WhatsApp messages webhooks
 */
export async function POST(request: Request) {
  try {
    const signature = request.headers.get('X-Twilio-Signature');
    const authToken = process.env.WHATSAPP_AUTH_TOKEN;
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`;

    if (!authToken) {
      console.error('WhatsApp webhook: Missing WHATSAPP_AUTH_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Webhook token not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await handleWhatsAppWebhook(request, authToken, webhookUrl);

    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        status: 500,
        message: 'Internal server error',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/webhooks/whatsapp
 * Handle WhatsApp webhook verification challenge
 */
export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const verification = verifyWhatsAppWebhookChallenge(request, verifyToken || '');

  if (verification.valid && verification.challenge) {
    console.log('WhatsApp webhook verified');
    return new Response(verification.challenge);
  }

  console.warn('WhatsApp webhook verification failed - invalid token or challenge');
  return new Response('Forbidden', { status: 403 });
}

// ============================================================
// FILE: app/api/webhooks/forms/route.ts
// ============================================================

import { handleWebsiteFormWebhook } from '@/lib/webhooks/website-form-webhook';

/**
 * POST /api/webhooks/forms
 * Handle website form submission webhooks
 */
export async function POST(request: Request) {
  try {
    const signature = request.headers.get('X-Signature');
    const secret = process.env.FORM_WEBHOOK_SECRET;

    // Extract workspace and agent from headers or payload
    const workspaceId = request.headers.get('X-Workspace-ID') || undefined;
    const agentId = request.headers.get('X-Agent-ID') || undefined;

    if (!secret) {
      console.error('Form webhook: Missing FORM_WEBHOOK_SECRET');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await handleWebsiteFormWebhook(
      request,
      signature,
      secret,
      workspaceId,
      agentId
    );

    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Form webhook error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        status: 500,
        message: 'Internal server error',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================
// ENVIRONMENT VARIABLES (.env.local)
// ============================================================

/*
# Facebook Webhook
FACEBOOK_WEBHOOK_SECRET=<your_app_secret_here>
FACEBOOK_WEBHOOK_VERIFY_TOKEN=<your_custom_token>

# Instagram Webhook
INSTAGRAM_WEBHOOK_SECRET=<your_app_secret_here>
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=<your_custom_token>

# WhatsApp Webhook
WHATSAPP_AUTH_TOKEN=<your_auth_token>
WHATSAPP_VERIFY_TOKEN=<your_custom_token>
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Form Webhook
FORM_WEBHOOK_SECRET=<your_shared_secret>

# Optional
USE_MOCK_MODE=false
*/

// ============================================================
// TESTING
// ============================================================

/*
# Test Facebook webhook locally
curl -X POST http://localhost:3000/api/webhooks/facebook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"entry":[{"changes":[{"field":"feed","value":{"message":"Test comment","from":{"id":"123","name":"Test User"}}}]}]}'

# Test form webhook
curl -X POST http://localhost:3000/api/webhooks/forms \
  -H "Content-Type: application/json" \
  -H "X-Signature: ..." \
  -H "X-Workspace-ID: ws_123" \
  -H "X-Agent-ID: ag_123" \
  -d '{"name":"John","email":"john@example.com","message":"Help"}'
*/

// ============================================================
// PLATFORM DASHBOARD CONFIGURATION
// ============================================================

/*
FACEBOOK:
1. Go to https://developers.facebook.com/
2. Select your app
3. Products > Webhooks > Add
4. Select "Page" and "Instagram" resources
5. Webhook URL: https://your-domain.com/api/webhooks/facebook
6. Verify Token: Set to FACEBOOK_WEBHOOK_VERIFY_TOKEN value
7. Subscribe to events: feed, messages

INSTAGRAM:
1. Similar to Facebook (same Graph API)
2. Webhook URL: https://your-domain.com/api/webhooks/instagram
3. Subscribe to: comments, messages

WHATSAPP:
1. Go to WhatsApp Business API dashboard
2. Webhook Settings
3. Callback URL: https://your-domain.com/api/webhooks/whatsapp
4. Verify Token: Set to WHATSAPP_VERIFY_TOKEN value

WEBSITE FORMS:
1. Deploy endpoint to production
2. Configure your form to POST to https://your-domain.com/api/webhooks/forms
3. Generate signature on client and include as X-Signature header
*/
