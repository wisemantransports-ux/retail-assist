/**
 * Centralized environment variable configuration
 * Ensures consistent access to env vars across the app
 * Supports both mock mode (local dev) and live mode (production)
 */

export const env = {
  // Supabase (client-side + server-side)
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '', // Server-only, never expose to client
  },

  // Mock mode flag — keep enabled by default until you explicitly go-live with Supabase.
  // Set NEXT_PUBLIC_USE_MOCK_SUPABASE = "false" in your environment to disable mock mode.
  useMockMode: (typeof process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE !== 'undefined') ? process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE === 'true' : true,

  // OpenAI (server-side only)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  // Mock payments flag — enabled by default while in mock mode. Set NEXT_PUBLIC_USE_MOCK_PAYMENTS=false to enable live payments.
  useMockPayments: (typeof process.env.NEXT_PUBLIC_USE_MOCK_PAYMENTS !== 'undefined') ? process.env.NEXT_PUBLIC_USE_MOCK_PAYMENTS === 'true' : true,

  // Meta/Facebook (server-side only)
  meta: {
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || '',
    verifyToken: process.env.META_VERIFY_TOKEN || '',
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
  },

  // Facebook Graph API
  facebook: {
    graphApiVersion: process.env.FACEBOOK_GRAPH_API_VERSION || 'v19.0',
  },

  // WhatsApp Cloud API
  whatsapp: {
    apiToken: process.env.WHATSAPP_API_TOKEN || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  },

  // Stripe (payment processing)
  stripe: {
    apiKey: process.env.STRIPE_API_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  // PayPal
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
    apiBase: process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com',
    mode: process.env.PAYPAL_MODE || 'sandbox', // sandbox or live
  },

  // Mobile money support
  mobileMoney: {
    supportEmail: process.env.MOBILE_MONEY_SUPPORT_EMAIL || '',
  },

  // Test/Debug mode
  isTestMode: process.env.NEXT_PUBLIC_TEST_MODE === 'true',

  // App environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // App URLs
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000',
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:5000/dashboard',
  
  // Alerts
  alertEmail: process.env.ALERT_EMAIL || '',
  whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  sentryDsn: process.env.SENTRY_DSN || '',
};

/**
 * Validate that required env vars are set
 * Call this in critical API routes
 */
export function validateEnv(required: string[]): boolean {
  return required.every((key) => {
    if (!process.env[key]) {
      console.warn(`Missing required environment variable: ${key}`);
      return false;
    }
    return true;
  });
}

// Production safety: do not allow mock mode in production builds.
// Require explicit NEXT_PUBLIC_USE_MOCK_SUPABASE=false in production; otherwise fail-fast.
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCK_SUPABASE !== 'false') {
  throw new Error(
    'Production cannot run with mock Supabase. Set NEXT_PUBLIC_USE_MOCK_SUPABASE=false and provide SUPABASE_* env vars.'
  );
}
