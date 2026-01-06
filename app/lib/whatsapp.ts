/**
 * WhatsApp Business API Service Library
 * Real WhatsApp API integration for message sending
 */

import crypto from 'crypto';
import { env } from './env';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  type: string;
}

export interface WhatsAppContact {
  wa_id: string;
  profile: {
    name: string;
  };
}

function logWaOperation(operation: string, details: any) {
  console.log(`[WhatsApp API] ${operation}`, details);
}

function buildWhatsAppUrl(endpoint: string): string {
  const version = 'v20.0';
  const phoneNumberId = env.whatsapp.phoneNumberId;
  return `https://graph.facebook.com/${version}/${phoneNumberId}${endpoint}`;
}

/**
 * Send a WhatsApp message via Business API
 */
export async function waSendMessage(
  recipientId: string,
  message: string,
  accessToken?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = accessToken || env.whatsapp.apiToken;

    logWaOperation('Send message', {
      recipientId,
      messageLength: message.length,
      accessToken: token ? '***' : 'MISSING',
    });

    if (!token) {
      return {
        success: false,
        error: 'WhatsApp access token not configured',
      };
    }

    const url = buildWhatsAppUrl('/messages');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'text',
        text: {
          body: message,
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`[WhatsApp API] Message error:`, data.error);
      return {
        success: false,
        error: data.error.message || 'Failed to send message',
      };
    }

    console.log(`[WhatsApp API] Message sent:`, data.messages?.[0]?.id);
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error(`[WhatsApp API] Error sending message:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Send a WhatsApp template message
 */
export async function waSendTemplateMessage(
  recipientId: string,
  templateName: string,
  languageCode: string = 'en_US',
  components?: any[],
  accessToken?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = accessToken || env.whatsapp.apiToken;

    logWaOperation('Send template message', {
      recipientId,
      templateName,
      languageCode,
      accessToken: token ? '***' : 'MISSING',
    });

    if (!token) {
      return {
        success: false,
        error: 'WhatsApp access token not configured',
      };
    }

    const url = buildWhatsAppUrl('/messages');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          components,
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`[WhatsApp API] Template message error:`, data.error);
      return {
        success: false,
        error: data.error.message || 'Failed to send template message',
      };
    }

    console.log(`[WhatsApp API] Template message sent:`, data.messages?.[0]?.id);
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error(`[WhatsApp API] Error sending template message:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Verify WhatsApp webhook signature
 */
export function verifyWhatsAppSignature(payload: string, signature: string, appSecret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload, 'utf8')
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}

/**
 * Parse WhatsApp webhook payload
 */
export function parseWhatsAppWebhook(payload: any): any {
  // Placeholder for WhatsApp webhook parsing
  // Similar to Meta webhook parsing
  return payload;
}

/**
 * Format WhatsApp API error
 */
export function formatWhatsAppError(error: any): string {
  if (error?.message) return error.message;
  if (error?.error?.message) return error.error.message;
  return 'Unknown WhatsApp API error';
}

/**
 * Get WhatsApp business account info
 */
export async function getWhatsAppBusinessAccount(accessToken?: string): Promise<any> {
  try {
    const token = accessToken || env.whatsapp.apiToken;

    if (!token) {
      throw new Error('WhatsApp access token not configured');
    }

    const url = buildWhatsAppUrl('/');
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return await response.json();
  } catch (error: any) {
    console.error(`[WhatsApp API] Error getting business account:`, error);
    throw error;
  }
}