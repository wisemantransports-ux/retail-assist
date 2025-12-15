import { env } from '../env';

/**
 * Mobile Money Billing Helpers (server-side)
 * - Generate unique reference codes
 * - Send admin notifications
 * - Handle payment confirmations
 *
 * Supports mock mode: when NEXT_PUBLIC_USE_MOCK_PAYMENTS = true
 */

/**
 * Generate unique reference code for tracking mobile money payments
 * Format: MM-TIMESTAMP-RANDOM-PROVIDER
 */
export function generateMobileMoneyReference(provider: 'mtn' | 'vodacom' | 'airtel' = 'mtn'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const providerCode = provider.substring(0, 1).toUpperCase();

  return `MM-${providerCode}-${timestamp}-${random}`;
}

/**
 * Send admin notification about pending mobile money payment
 * In production, integrate with SendGrid, Mailgun, AWS SES, etc.
 */
export async function sendPendingPaymentNotification(
  referenceCode: string,
  phoneNumber: string,
  amount: number,
  currency: string = 'BWP',
  workspaceId?: string
): Promise<{ success: boolean; error?: string }> {
  if (env.useMockPayments) {
    console.log('[MobileMoneyBilling] Mock notification sent', {
      referenceCode,
      phoneNumber,
      amount,
      currency,
    });
    return { success: true };
  }

  const supportEmail = env.mobileMoney.supportEmail;
  if (!supportEmail) {
    console.warn('[MobileMoneyBilling] Support email not configured');
    return { success: false, error: 'Support email not configured' };
  }

  try {
    // TODO: Integrate with email service
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // const msg = {
    //   to: supportEmail,
    //   from: 'noreply@retailassist.app',
    //   subject: `Mobile Money Payment Pending: ${referenceCode}`,
    //   html: generateEmailTemplate(referenceCode, phoneNumber, amount, currency, workspaceId),
    // };
    // await sgMail.send(msg);

    console.log('[MobileMoneyBilling] Notification queued (email service not configured)', {
      to: supportEmail,
      referenceCode,
      phoneNumber,
      amount,
      currency,
    });

    return { success: true };
  } catch (error) {
    console.error('[MobileMoneyBilling] Error sending notification:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate email template for payment notification
 */
function generateEmailTemplate(
  referenceCode: string,
  phoneNumber: string,
  amount: number,
  currency: string,
  workspaceId?: string
): string {
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
  const adminPageUrl = `${dashboardUrl}/dashboard/billing/admin`;

  return `
    <h2>Mobile Money Payment Pending Approval</h2>
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Reference Code:</strong> ${referenceCode}</p>
      <p><strong>Phone Number:</strong> ${phoneNumber}</p>
      <p><strong>Amount:</strong> ${amount} ${currency}</p>
      <p><strong>Status:</strong> <span style="color: #ff9800;">Pending Review</span></p>
      ${workspaceId ? `<p><strong>Workspace ID:</strong> ${workspaceId}</p>` : ''}
    </div>
    <p>
      <a href="${adminPageUrl}" style="
        background-color: #2196F3;
        color: white;
        padding: 10px 20px;
        text-decoration: none;
        border-radius: 5px;
        display: inline-block;
      ">Review in Dashboard</a>
    </p>
    <p style="color: #999; font-size: 12px;">
      This is an automated message. Please do not reply to this email.
    </p>
  `;
}

/**
 * Validate mobile money phone number format
 */
export function validatePhoneNumber(phoneNumber: string, provider: 'mtn' | 'vodacom' | 'airtel' = 'mtn'): boolean {
  // Remove spaces and special characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Botswana phone numbers are typically:
  // MTN: 267 71-99, 73-79
  // Vodacom: 267 74-76
  // Airtel: 267 72
  // Must be 10 digits or 12 digits with country code (267)

  if (cleaned.length === 10) {
    // Local format: 7XXXXXXXX
    return /^7[1-9]\d{8}$/.test(cleaned);
  } else if (cleaned.length === 12 && cleaned.startsWith('267')) {
    // International format: 267XXXXXXXXXX
    const localPart = cleaned.substring(3);
    return /^7[1-9]\d{8}$/.test(localPart);
  }

  return false;
}

/**
 * Format phone number to international format
 */
export function formatPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');

  if (cleaned.length === 10) {
    // Local: 7XXXXXXXX → 267XXXXXXXXXX
    return `267${cleaned}`;
  } else if (cleaned.length === 12 && cleaned.startsWith('267')) {
    return cleaned;
  } else if (cleaned.length === 12 && !cleaned.startsWith('267')) {
    // Invalid international code
    return `267${cleaned.substring(2)}`;
  }

  // Return as-is if format unknown
  return phoneNumber;
}

/**
 * Get mobile money provider from phone number
 * Used for auto-detection, though users can also select manually
 */
export function detectProvider(phoneNumber: string): 'mtn' | 'vodacom' | 'airtel' {
  const formatted = formatPhoneNumber(phoneNumber);
  const localPart = formatted.substring(3, 5); // Get first 2 digits after country code

  // Botswana prefixes (first 2 digits after country code)
  // MTN: 71-79
  // Vodacom: 74-76
  // Airtel: 72

  if (localPart.startsWith('72')) {
    return 'airtel';
  } else if (['74', '75', '76'].includes(localPart)) {
    return 'vodacom';
  } else {
    // Default to MTN for 71, 73, 77, 78, 79
    return 'mtn';
  }
}
