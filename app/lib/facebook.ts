/**
 * Facebook/Meta API Service Library
 * Real Graph API integration for Facebook & Instagram automation
 */

import crypto from 'crypto';
import { env } from './env';

export interface FacebookComment {
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

export interface FacebookMessage {
  id: string;
  text?: string;
  from: {
    name: string;
    id: string;
  };
  created_timestamp: string;
}

export interface FacebookUser {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

function logFbOperation(operation: string, details: any) {
  console.log(`[Facebook API] ${operation}`, details);
}

function buildGraphUrl(endpoint: string): string {
  const version = 'v19.0';
  return `https://graph.facebook.com/${version}${endpoint}`;
}

/**
 * Reply to a Facebook comment using Graph API
 */
export async function fbReplyToComment(
  commentId: string,
  message: string,
  pageAccessToken?: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const token = pageAccessToken || env.meta.pageAccessToken;

    logFbOperation('Reply to comment', {
      commentId,
      messageLength: message.length,
      accessToken: token ? '***' : 'MISSING',
    });

    if (!token) {
      return {
        success: false,
        error: 'Page access token not configured',
      };
    }

    const url = `${buildGraphUrl(`/${commentId}/comments`)}?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        message,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`[Facebook API] Comment reply error:`, data.error);
      return {
        success: false,
        error: data.error.message || 'Failed to reply to comment',
      };
    }

    console.log(`[Facebook API] Comment reply sent:`, data.id);
    return {
      success: true,
      replyId: data.id,
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error(`[Facebook API] Error replying to comment:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Send a direct message via Messenger using Send API
 */
export async function fbSendDM(
  recipientId: string,
  message: string,
  pageAccessToken?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = pageAccessToken || env.meta.pageAccessToken;

    logFbOperation('Send DM', {
      recipientId,
      messageLength: message.length,
      accessToken: token ? '***' : 'MISSING',
    });

    if (!token) {
      return {
        success: false,
        error: 'Page access token not configured',
      };
    }

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
      console.error(`[Facebook API] DM error:`, data.error);
      return {
        success: false,
        error: data.error.message || 'Failed to send message',
      };
    }

    console.log(`[Facebook API] DM sent:`, data.message_id);
    return {
      success: true,
      messageId: data.message_id,
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error(`[Facebook API] Error sending DM:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Fetch Facebook user profile information
 */
export async function fbFetchUserProfile(
  userId: string,
  accessToken: string
): Promise<FacebookUser | null> {
  try {
    logFbOperation('Fetch user profile', { userId });

    const url = buildGraphUrl(`/${userId}?fields=id,name,email,picture&access_token=${accessToken}`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error(`[Facebook API] Profile fetch error:`, data.error);
      return null;
    }

    return data as FacebookUser;
  } catch (error: any) {
    console.error(`[Facebook API] Error fetching user profile:`, error.message);
    return null;
  }
}

/**
 * Verify Facebook webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  xHubSignature: string
): boolean {
  try {
    if (!env.meta.appSecret) {
      console.warn('[Facebook API] APP_SECRET not configured, skipping signature verification');
      return true;
    }

    if (!xHubSignature) {
      console.warn('[Facebook API] No signature provided');
      return false;
    }

    const hash = crypto
      .createHmac('sha256', env.meta.appSecret)
      .update(body)
      .digest('hex');
    
    const expectedSignature = `sha256=${hash}`;
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(xHubSignature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return xHubSignature === expectedSignature;
    }
  } catch (error: any) {
    console.error('[Facebook API] Error verifying webhook signature:', error.message);
    return false;
  }
}

export interface FacebookWebhookEvent {
  eventType: 'comment' | 'message' | 'comment_reply' | 'comment_edit' | 'unknown';
  pageId: string;
  comment?: {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    postId: string;
    createdTime: string;
  };
  message?: {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
  };
  rawPayload: any;
}

/**
 * Parse Facebook webhook payload
 */
export function parseFacebookWebhook(payload: any): FacebookWebhookEvent | null {
  try {
    logFbOperation('Parse webhook payload', {
      object: payload.object,
      entryCount: payload.entry?.length || 0,
    });

    if (payload.object !== 'page') {
      return null;
    }

    const entry = payload.entry?.[0];
    if (!entry) return null;

    const pageId = entry.id;

    if (entry.changes) {
      const change = entry.changes[0];
      if (change.field === 'feed') {
        const value = change.value;
        if (value.item === 'comment') {
          return {
            eventType: 'comment',
            pageId,
            comment: {
              id: value.comment_id || value.id,
              text: value.message || '',
              authorId: value.from?.id || '',
              authorName: value.from?.name || 'Unknown',
              postId: value.post_id || value.object_id,
              createdTime: value.created_time || new Date().toISOString(),
            },
            rawPayload: payload,
          };
        }
      }
    }

    if (entry.messaging) {
      const msg = entry.messaging[0];
      if (msg.message && !msg.message.is_echo) {
        return {
          eventType: 'message',
          pageId,
          message: {
            id: msg.message.mid,
            text: msg.message.text || '',
            senderId: msg.sender.id,
            senderName: 'User',
            timestamp: msg.timestamp,
          },
          rawPayload: payload,
        };
      }
    }

    return {
      eventType: 'unknown',
      pageId,
      rawPayload: payload,
    };
  } catch (error: any) {
    console.error('[Facebook API] Error parsing webhook payload:', error.message);
    return null;
  }
}

export function formatFacebookError(error: any): string {
  if (error.error?.message) {
    return error.error.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'Unknown Facebook API error';
}
