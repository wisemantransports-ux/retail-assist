import { env } from '../env';

/**
 * Mobile Money Payment Helper (server-side)
 * - Reference code generation
 * - Admin notification (placeholder)
 */

export function generateReferenceCode(): string {
  /**
   * Generate unique reference code for tracking
   * Format: MM-TIMESTAMP-RANDOM
   */
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `MM-${timestamp}-${random}`;
}

export async function sendAdminNotificationEmail(
  phoneNumber: string,
  amount: number,
  referenceCode: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  if (env.useMockMode) {
    console.log(
      '[Mobile Money] Mock mode: Would send admin notification',
      { phoneNumber, amount, referenceCode }
    );
    return { success: true };
  }

  const supportEmail = env.mobileMoney.supportEmail;
  if (!supportEmail) {
    console.warn('[Mobile Money] Missing MOBILE_MONEY_SUPPORT_EMAIL');
    return { success: false, error: 'Support email not configured' };
  }

  try {
    // TODO: Integrate with actual email service (SendGrid, Mailgun, etc.)
    // For now, this is a placeholder
    console.log('[Mobile Money] Admin notification queued', {
      to: supportEmail,
      phoneNumber,
      amount,
      referenceCode,
      workspaceId,
    });

    // Example structure for email service integration:
    // const result = await sendEmail({
    //   to: supportEmail,
    //   subject: `Mobile Money Payment Pending: ${referenceCode}`,
    //   html: `
    //     <h2>Mobile Money Payment Received</h2>
    //     <p><strong>Reference Code:</strong> ${referenceCode}</p>
    //     <p><strong>Phone:</strong> ${phoneNumber}</p>
    //     <p><strong>Amount:</strong> ${amount} BWP</p>
    //     <p><strong>Status:</strong> Pending Review</p>
    //     <p><a href="...admin-payments-link...">Review Payment</a></p>
    //   `,
    // });
    // return { success: result.success, error: result.error };

    return { success: true };
  } catch (error) {
    console.error('[Mobile Money] Failed to send admin notification:', error);
    return { success: false, error: String(error) };
  }
}
