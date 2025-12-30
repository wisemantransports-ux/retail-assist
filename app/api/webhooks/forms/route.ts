import { env } from '@/lib/env';
import { handleWebsiteFormWebhook } from '@/lib/webhooks/website-form-webhook';

/**
 * POST /api/webhooks/forms
 * Handle website form submission webhooks
 */
export async function POST(request: Request) {
  try {
    const signature = request.headers.get('X-Signature');
    const secret = (globalThis as any).process?.env?.FORM_WEBHOOK_SECRET || '';

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
