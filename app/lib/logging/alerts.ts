/**
 * Alert System
 * Sends alerts for critical events: payment failures, webhook failures, pending manual payments, etc.
 */

import { env } from '@/lib/env';

export type AlertType = 'payment_failed' | 'webhook_error' | 'manual_payment_pending' | 'quota_exceeded' | 'rate_limit' | 'system_error';

/**
 * Send an alert to admin
 */
export async function sendAlert(
  type: AlertType,
  title: string,
  message: string,
  metadata?: Record<string, any>
) {
  if (env.useMockPayments) {
    console.log('[alerts] Mock mode: alert would be sent', { type, title, message });
    return true;
  }

  const alertEmail = env.alertEmail;
  if (!alertEmail) {
    console.warn('[alerts] No alert email configured');
    return false;
  }

  try {
    // Send email alert
    await sendEmailAlert(alertEmail, type, title, message, metadata);

    // TODO: Send WhatsApp alert if webhook configured
    if (env.whatsappWebhookUrl) {
      await sendWhatsAppAlert(type, title, message, metadata);
    }

    console.log('[alerts] Alert sent:', { type, title });
    return true;
  } catch (e) {
    console.error('[alerts] Failed to send alert:', e);
    return false;
  }
}

/**
 * Send email alert using a transactional email service (e.g., SendGrid, Resend)
 */
async function sendEmailAlert(
  toEmail: string,
  type: AlertType,
  title: string,
  message: string,
  metadata?: Record<string, any>
) {
  // Placeholder - implement with your email service
  // Example with Resend:
  // const { Resend } = require('resend');
  // const resend = new Resend(env.resendApiKey);
  // await resend.emails.send({
  //   from: 'alerts@retailassist.app',
  //   to: toEmail,
  //   subject: `[ALERT] ${title}`,
  //   html: generateEmailTemplate(type, title, message, metadata),
  // });

  console.log('[alerts] Email alert:', { to: toEmail, type, title });
}

/**
 * Send WhatsApp alert
 */
async function sendWhatsAppAlert(
  type: AlertType,
  title: string,
  message: string,
  metadata?: Record<string, any>
) {
  // Placeholder - implement with WhatsApp Business API or twilio
  console.log('[alerts] WhatsApp alert:', { type, title, message });
}

/**
 * Generate alert email template
 */
function generateEmailTemplate(
  type: AlertType,
  title: string,
  message: string,
  metadata?: Record<string, any>
): string {
  const typeColors: Record<AlertType, string> = {
    payment_failed: '#EF4444',
    webhook_error: '#F59E0B',
    manual_payment_pending: '#3B82F6',
    quota_exceeded: '#8B5CF6',
    rate_limit: '#F59E0B',
    system_error: '#EF4444',
  };

  const color = typeColors[type];

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .timestamp { font-size: 12px; color: #999; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${title}</h1>
            <p style="margin: 5px 0 0 0;">Alert Type: ${type}</p>
          </div>
          <div class="content">
            <p>${message}</p>
            ${metadata ? `<pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(metadata, null, 2)}</pre>` : ''}
            <p><a href="${env.appUrl}/admin/logs" style="color: ${color}; text-decoration: none;">View Logs →</a></p>
            <p class="timestamp">${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Alert helpers for specific scenarios
 */

export async function alertPaymentFailure(
  workspaceId: string,
  subscriptionId: string,
  reason: string
) {
  await sendAlert(
    'payment_failed',
    'Payment Failed',
    `Subscription ${subscriptionId} for workspace ${workspaceId} failed to process. Reason: ${reason}`,
    { workspaceId, subscriptionId, reason }
  );
}

export async function alertWebhookFailure(
  provider: 'stripe' | 'paypal' | 'facebook',
  eventType: string,
  error: string
) {
  await sendAlert(
    'webhook_error',
    `${provider} Webhook Error`,
    `Failed to process ${provider} event: ${eventType}. Error: ${error}`,
    { provider, eventType, error }
  );
}

export async function alertManualPaymentPending(
  count: number
) {
  if (count > 0) {
    await sendAlert(
      'manual_payment_pending',
      `${count} Pending Manual Payments`,
      `${count} manual payment(s) awaiting admin approval. Review in the approvals dashboard.`,
      { pendingCount: count }
    );
  }
}

export async function alertRateLimitError(
  service: string,
  retryAfter?: number
) {
  await sendAlert(
    'rate_limit',
    `Rate Limit: ${service}`,
    `${service} rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : ''}`,
    { service, retryAfter }
  );
}

export async function alertSystemError(
  context: string,
  error: Error
) {
  await sendAlert(
    'system_error',
    `System Error: ${context}`,
    `An unexpected error occurred. ${error.message}`,
    {
      context,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    }
  );
}
