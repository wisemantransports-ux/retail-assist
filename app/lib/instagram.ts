/**
 * Instagram/Meta API Service Library
 * Real Graph API integration for Instagram automation
 */

import crypto from 'crypto';
import { env } from './env';

export interface InstagramComment {
  id: string;
  message: string;
  created_time: string;
  from: {
    name: string;
    id: string;
    email?: string;
  };
  object: string;
  permalink_url?: string;
}

export interface InstagramMessage {
  id: string;
  text?: string;
  from: {
    name: string;
    id: string;
  };
  created_timestamp: string;
}

export interface InstagramUser {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

function logIgOperation(operation: string, details: any) {
  console.log(`[Instagram API] ${operation}`, details);
}

function buildGraphUrl(endpoint: string): string {
  const version = 'v19.0';
  return `https://graph.facebook.com/${version}${endpoint}`;
}

/**
 * Send a direct message via Instagram using Send API
 * Note: Instagram DMs use the same API as Facebook Messenger
 */
export async function igSendDM(
  recipientId: string,
  message: string,
  pageAccessToken?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = pageAccessToken || env.meta.pageAccessToken;

    logIgOperation('Send DM', {
      recipientId,
      messageLength: message.length,
      accessToken: token ? '***' : 'MISSING',
    });

    if (!token) {
      return {
        success: false,
        error: 'Instagram access token not configured',
      };
    }

    // Instagram DMs use the same Send API as Facebook Messenger
    const url = `${buildGraphUrl('/me/messages')}?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'RESPONSE',
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`[Instagram API] DM error:`, data.error);
      return {
        success: false,
        error: data.error.message || 'Failed to send message',
      };
    }

    console.log(`[Instagram API] DM sent:`, data.message_id);
    return {
      success: true,
      messageId: data.message_id,
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error(`[Instagram API] Error sending DM:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Reply to an Instagram comment using Graph API
 */
export async function igReplyToComment(
  commentId: string,
  message: string,
  accessToken?: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const token = accessToken || env.meta.pageAccessToken;

    logIgOperation('Reply to comment', {
      commentId,
      messageLength: message.length,
      accessToken: token ? '***' : 'MISSING',
    });

    if (!token) {
      return {
        success: false,
        error: 'Instagram access token not configured',
      };
    }

    const url = `${buildGraphUrl(`/${commentId}/replies`)}?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`[Instagram API] Comment reply error:`, data.error);
      return {
        success: false,
        error: data.error.message || 'Failed to reply to comment',
      };
    }

    console.log(`[Instagram API] Comment reply sent:`, data.id);
    return {
      success: true,
      replyId: data.id,
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error(`[Instagram API] Error replying to comment:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

export function verifyInstagramSignature(payload: string, signature: string, appSecret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload, 'utf8')
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}

export function parseInstagramWebhook(payload: any): any {
  // Placeholder for Instagram webhook parsing
  // Similar to Facebook webhook parsing
  return payload;
}

export function formatInstagramError(error: any): string {
  if (error?.message) return error.message;
  if (error?.error?.message) return error.error.message;
  return 'Unknown Instagram API error';
}