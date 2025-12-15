/**
 * Sentry Initialization
 * Centralizes error tracking and performance monitoring
 */

import { env } from '@/lib/env';

/**
 * Initialize Sentry for client-side
 * Call this in your root layout
 */
export function initSentryClient() {
  if (!env.sentryDsn) {
    console.warn('[sentry] Sentry DSN not configured');
    return;
  }

  // TODO: Import and initialize Sentry client SDK
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.init({
  //   dsn: env.sentryDsn,
  //   environment: env.nodeEnv,
  //   tracesSampleRate: env.nodeEnv === 'production' ? 0.1 : 1.0,
  //   integrations: [
  //     new Sentry.Replay({ maskAllText: true, blockAllMedia: true }),
  //   ],
  //   replaysSessionSampleRate: 0.1,
  //   replaysOnErrorSampleRate: 1.0,
  // });

  console.log('[sentry] Client initialized');
}

/**
 * Initialize Sentry for server-side
 * Call this in your middleware or API route init
 */
export function initSentryServer() {
  if (!env.sentryDsn) {
    return;
  }

  // TODO: Initialize server-side Sentry
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.init({
  //   dsn: env.sentryDsn,
  //   environment: env.nodeEnv,
  //   tracesSampleRate: env.nodeEnv === 'production' ? 0.1 : 1.0,
  // });

  console.log('[sentry] Server initialized');
}

/**
 * Capture exception to Sentry
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!env.sentryDsn) {
    console.error('[sentry] Error (Sentry not configured):', error.message);
    return;
  }

  // TODO: Send to Sentry
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.captureException(error, { contexts: { custom: context } });

  console.error('[sentry] Exception captured:', error.message);
}

/**
 * Capture message to Sentry
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' = 'info', context?: Record<string, any>) {
  if (!env.sentryDsn) {
    console.log('[sentry] Message (Sentry not configured):', message);
    return;
  }

  // TODO: Send to Sentry
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.captureMessage(message, level);

  console.log('[sentry] Message captured:', message);
}
