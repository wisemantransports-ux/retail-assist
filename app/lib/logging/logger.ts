/**
 * Centralized Logging Utility
 * Writes to: system_logs table, Sentry (if configured), Netlify logs
 */

import { insertSystemLog } from '@/lib/supabase/queries';
import { env } from '@/lib/env';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

/**
 * Main logger interface
 */
export interface Logger {
  debug(message: string, metadata?: Record<string, any>): Promise<void>;
  info(message: string, metadata?: Record<string, any>): Promise<void>;
  warn(message: string, metadata?: Record<string, any>): Promise<void>;
  error(message: string, error?: Error | unknown, metadata?: Record<string, any>): Promise<void>;
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(
  source: string,
  workspaceId?: string,
  userId?: string
): Logger {
  return {
    async debug(message, metadata = {}) {
      await logMessage('debug', message, source, workspaceId, userId, metadata);
    },
    async info(message, metadata = {}) {
      await logMessage('info', message, source, workspaceId, userId, metadata);
    },
    async warn(message, metadata = {}) {
      await logMessage('warning', message, source, workspaceId, userId, metadata);
    },
    async error(message, error, metadata = {}) {
      const errorDetails = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { error: String(error) };
      await logMessage('error', message, source, workspaceId, userId, { ...metadata, ...errorDetails });
    },
  };
}

/**
 * Internal logging function
 */
async function logMessage(
  level: LogLevel,
  message: string,
  source: string,
  workspaceId?: string,
  userId?: string,
  metadata?: Record<string, any>,
  stackTrace?: string
) {
  // Always log to console in development
  if (level === 'error') {
    console.error(`[${source.toUpperCase()}] ${message}`, metadata);
  } else if (level === 'warning') {
    console.warn(`[${source.toUpperCase()}] ${message}`, metadata);
  } else {
    console.log(`[${source.toUpperCase()}] ${message}`, metadata);
  }

  // Write to system_logs table (non-blocking)
  try {
    await insertSystemLog(level, workspaceId || null, userId || null, source, message, metadata, stackTrace);
  } catch (e) {
    console.error('[logging] Failed to write to system_logs:', e);
  }

  // TODO: Send to Sentry if configured
  if (env.sentryDsn && level === 'error') {
    // captureException or captureMessage to Sentry
  }

  // Netlify logs are automatic via console output
}

/**
 * Standalone logging functions (for one-off logs without context)
 */
export const logger = {
  async debug(message: string, metadata?: Record<string, any>) {
    await logMessage('debug', message, 'app', undefined, undefined, metadata);
  },

  async info(message: string, metadata?: Record<string, any>) {
    await logMessage('info', message, 'app', undefined, undefined, metadata);
  },

  async warn(message: string, metadata?: Record<string, any>) {
    await logMessage('warning', message, 'app', undefined, undefined, metadata);
  },

  async error(message: string, error?: Error | unknown, metadata?: Record<string, any>) {
    const errorDetails = error instanceof Error ? { name: error.name, message: error.message } : {};
    await logMessage('error', message, 'app', undefined, undefined, { ...metadata, ...errorDetails }, error instanceof Error ? error.stack : undefined);
  },
};

/**
 * Helper to log webhook processing
 */
export async function logWebhookEvent(
  provider: 'stripe' | 'paypal' | 'facebook',
  eventType: string,
  workspaceId?: string,
  success: boolean = true,
  metadata?: Record<string, any>
) {
  const message = `${provider} webhook: ${eventType} - ${success ? 'success' : 'failed'}`;
  const level = success ? 'info' : 'warning';
  await logMessage(level, message, `${provider}_webhook`, workspaceId, undefined, metadata);
}

/**
 * Helper to log API route execution
 */
export async function logApiRoute(
  routeName: string,
  workspaceId: string | null,
  userId: string | null,
  statusCode: number,
  duration: number,
  metadata?: Record<string, any>
) {
  const level = statusCode >= 400 ? 'warning' : 'info';
  await logMessage(level, `${routeName} - ${statusCode}`, 'api', workspaceId, userId, {
    statusCode,
    duration: `${duration}ms`,
    ...metadata,
  });
}
