import { env } from '@/lib/env';
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
    const authToken = env.whatsapp.apiToken || '';
    const webhookUrl = `${env.appUrl}/api/webhooks/whatsapp`;

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
  const verifyToken = (globalThis as any).process?.env?.WHATSAPP_VERIFY_TOKEN || '';
  const verification = verifyWhatsAppWebhookChallenge(request, verifyToken);

  if (verification.valid && verification.challenge) {
    console.log('WhatsApp webhook verified');
    return new Response(verification.challenge);
  }

  console.warn('WhatsApp webhook verification failed - invalid token or challenge');
  return new Response('Forbidden', { status: 403 });
}
